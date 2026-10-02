// Same PBKDF2/HMAC session logic as server/src/auth.js (the VPS backend),
// rewritten as an ES module for Vercel's Node.js functions.
import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
export const SESSION_COOKIE = "stf_session";

function toHex(buf) {
  return Buffer.from(buf).toString("hex");
}
function fromHex(h) {
  return Buffer.from(h, "hex");
}
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}
function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const bits = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split(":");
  if (parts.length !== 3) return false;
  const iterations = Number(parts[0]) || PBKDF2_ITERATIONS;
  const salt = fromHex(parts[1]);
  const bits = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return safeEqual(toHex(bits), parts[2]);
}

function hmac(secret, data) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function createSessionCookie(user, sessionSecret) {
  const payload = {
    uid: user.id,
    role: user.role,
    name: user.display_name || user.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = hmac(sessionSecret, payloadB64);
  const token = `${payloadB64}.${sig}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_TTL_SECONDS}`;
}

export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

// A long-lived, opaque per-browser id used only to stop the same visitor
// reacting to the same poster more than once (see POST
// /api/submissions/:id/reaction). Not a login session — no signature, no
// role, nothing worth forging — just a random id the server hands out once
// and then recognizes. localStorage alone can't do this job: the person
// asked specifically that re-opening the site must not reset the count,
// and a value only the server reads and writes survives that, where a
// value the page itself reads/writes (localStorage) is trivial to clear.
export const VISITOR_COOKIE = "stf_visitor";
const VISITOR_TTL_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

export function ensureVisitorId(req, res) {
  const existing = readCookie(req, VISITOR_COOKIE);
  if (existing && /^[a-f0-9-]{10,80}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  res.append("Set-Cookie", `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${VISITOR_TTL_SECONDS}`);
  return id;
}

export function verifySession(req, sessionSecret) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(sessionSecret, payloadB64);
  if (!safeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "jury" && payload.role !== "organizer") return null;
    return { uid: payload.uid, role: payload.role, name: payload.name || "" };
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(status, body) {
    super((body && body.error) || "error");
    this.status = status;
    this.body = body;
  }
}

export function requireRole(req, sessionSecret, roles) {
  const session = verifySession(req, sessionSecret);
  if (!session) throw new HttpError(401, { error: "unauthorized" });
  if (!roles.includes(session.role)) throw new HttpError(403, { error: "forbidden" });
  return session;
}
