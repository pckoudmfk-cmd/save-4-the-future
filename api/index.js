import express from "express";
import crypto from "node:crypto";
import { put as blobPut } from "@vercel/blob";

import { pool, ensureSchema, getSetting, setSetting } from "./_db.js";
import {
  hashPassword,
  verifyPassword,
  createSessionCookie,
  verifySession,
  requireRole,
  CLEAR_SESSION_COOKIE,
  HttpError,
} from "./_auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET;
const SETUP_KEY = process.env.SETUP_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Author name and group are withheld from everyone but the organizer until the
// organizer explicitly reveals them (the names_revealed setting) — jury judges
// anonymously, and the public gallery only shows poster numbers until then.
// The contact field (phone/email) is never made public, revealed or not.
const PUBLIC_COLUMNS = [
  "id", "poster_no", "title", "idea", "problem", "tools", "ai_how",
  "contribution", "interactive", "interactive_url", "image_key", "status",
  "audience_count", "created_at",
];
const PUBLIC_COLUMNS_WITH_NAMES = [...PUBLIC_COLUMNS, "author", "group_name"];
const ALL_COLUMNS = [
  "id", "poster_no", "title", "idea", "problem", "author", "group_name",
  "contact", "tools", "ai_how", "contribution", "interactive",
  "interactive_url", "image_key", "status", "audience_count", "created_at",
];

async function namesRevealed() {
  return (await getSetting("names_revealed", "false")) === "true";
}
const STATUS_VALUES = ["published", "rework", "rejected", "winner"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-setup-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/api/health", async (req, res) => {
  const info = { ok: true, service: "save-the-future-api", sessionSecretSet: Boolean(SESSION_SECRET) };
  try {
    await ensureSchema();
    info.db = "ok";
  } catch (e) {
    info.ok = false;
    info.db = "error";
    info.dbError = String(e && e.message ? e.message : e);
  }
  res.status(200).json(info);
});

app.use(async (req, res, next) => {
  try {
    if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not set in the Vercel project's environment variables");
    await ensureSchema();
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_not_configured" });
  }
});

app.use((req, res, next) => {
  if (req.method === "POST" && req.path.startsWith("/api/upload/")) return next();
  express.json({ limit: "1mb" })(req, res, next);
});

function asyncRoute(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      if (e instanceof HttpError) return res.status(e.status).json(e.body);
      console.error(e);
      res.status(500).json({ error: e && e.message ? e.message : "server_error" });
    });
  };
}

// ---- one-time bootstrap ----
async function runSetup(key, b, res) {
  if (!SETUP_KEY || key !== SETUP_KEY) return res.status(401).json({ error: "unauthorized" });
  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  if (countRows[0].c > 0) return res.status(409).json({ error: "already_initialized" });
  if (!b.username || !b.password) return res.status(400).json({ error: "username and password are required" });
  const hash = hashPassword(String(b.password));
  await pool.query(
    "INSERT INTO users(username,password_hash,role,display_name) VALUES($1,$2,'organizer',$3)",
    [String(b.username), hash, b.displayName || String(b.username)]
  );
  res.status(201).json({ ok: true });
}

app.post(
  "/api/setup",
  asyncRoute(async (req, res) => {
    await runSetup(req.headers["x-setup-key"], req.body || {}, res);
  })
);

// ---- auth ----
app.post(
  "/api/login",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    if (!b.username || !b.password) return res.status(400).json({ error: "username and password are required" });
    const { rows } = await pool.query(
      "SELECT id,username,password_hash,role,display_name FROM users WHERE username=$1",
      [String(b.username)]
    );
    const user = rows[0];
    if (!user || !verifyPassword(String(b.password), user.password_hash)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const cookie = createSessionCookie(user, SESSION_SECRET);
    res.setHeader("Set-Cookie", cookie);
    res.json({ id: user.id, username: user.username, role: user.role, displayName: user.display_name });
  })
);

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", CLEAR_SESSION_COOKIE);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const session = verifySession(req, SESSION_SECRET);
  res.json(
    session
      ? { authenticated: true, id: session.uid, role: session.role, displayName: session.name }
      : { authenticated: false }
  );
});

// ---- settings: whether author names are publicly revealed ----
// GET is public so the gallery/results pages know whether to show names.
// PATCH is organizer-only — this is the one switch that decides it, and
// only the organizer can flip it.
app.get(
  "/api/settings",
  asyncRoute(async (req, res) => {
    res.json({ namesRevealed: await namesRevealed() });
  })
);

app.patch(
  "/api/settings",
  asyncRoute(async (req, res) => {
    requireRole(req, SESSION_SECRET, ["organizer"]);
    const b = req.body || {};
    if (typeof b.namesRevealed !== "boolean") return res.status(400).json({ error: "namesRevealed must be a boolean" });
    await setSetting("names_revealed", b.namesRevealed ? "true" : "false");
    res.json({ ok: true, namesRevealed: b.namesRevealed });
  })
);

// ---- admin: manage jury/organizer accounts ----
app.get(
  "/api/admin/users",
  asyncRoute(async (req, res) => {
    requireRole(req, SESSION_SECRET, ["organizer"]);
    const { rows } = await pool.query(
      "SELECT id,username,role,display_name,created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: rows });
  })
);

app.post(
  "/api/admin/users",
  asyncRoute(async (req, res) => {
    requireRole(req, SESSION_SECRET, ["organizer"]);
    const b = req.body || {};
    if (!b.username || !b.password) return res.status(400).json({ error: "username and password are required" });
    const role = b.role === "organizer" ? "organizer" : "jury";
    const hash = hashPassword(String(b.password));
    try {
      await pool.query(
        "INSERT INTO users(username,password_hash,role,display_name) VALUES($1,$2,$3,$4)",
        [String(b.username), hash, role, b.displayName || String(b.username)]
      );
    } catch {
      return res.status(409).json({ error: "username_taken" });
    }
    res.status(201).json({ ok: true });
  })
);

// ---- submissions: list ----
app.get(
  "/api/submissions",
  asyncRoute(async (req, res) => {
    const session = verifySession(req, SESSION_SECRET);
    const isOrganizer = !!session && session.role === "organizer";
    const cols = (isOrganizer ? ALL_COLUMNS : (await namesRevealed()) ? PUBLIC_COLUMNS_WITH_NAMES : PUBLIC_COLUMNS).join(",");
    const sql = isOrganizer
      ? `SELECT ${cols} FROM submissions ORDER BY created_at DESC`
      : `SELECT ${cols} FROM submissions WHERE status IN ('published','winner') ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql);
    res.json({ submissions: rows });
  })
);

// ---- submissions: single ----
app.get(
  "/api/submissions/:id",
  asyncRoute(async (req, res) => {
    const session = verifySession(req, SESSION_SECRET);
    const isOrganizer = !!session && session.role === "organizer";
    const cols = (isOrganizer ? ALL_COLUMNS : (await namesRevealed()) ? PUBLIC_COLUMNS_WITH_NAMES : PUBLIC_COLUMNS).join(",");
    const sql = isOrganizer
      ? `SELECT ${cols} FROM submissions WHERE id=$1`
      : `SELECT ${cols} FROM submissions WHERE id=$1 AND status IN ('published','winner')`;
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  })
);

// ---- submissions: create (public — participants have no accounts) ----
app.post(
  "/api/submissions",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.idea || !b.aiHow) return res.status(400).json({ error: "title, idea and aiHow are required" });
    const id = crypto.randomUUID();
    const posterNo = Math.floor(100 + Math.random() * 900);
    await pool.query(
      `INSERT INTO submissions(id,poster_no,title,idea,problem,author,group_name,contact,tools,ai_how,contribution,interactive,interactive_url,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'moderation')`,
      [
        id, posterNo, String(b.title), String(b.idea), b.problem || "",
        b.author || "", b.group || "", b.contact || "", b.tools || "",
        String(b.aiHow), b.contribution || "", b.interactiveUrl ? 1 : 0, b.interactiveUrl || "",
      ]
    );
    res.status(201).json({ id, posterNo, status: "moderation" });
  })
);

// ---- submissions: moderation status (organizer only) ----
app.patch(
  "/api/submissions/:id/status",
  asyncRoute(async (req, res) => {
    requireRole(req, SESSION_SECRET, ["organizer"]);
    const b = req.body || {};
    if (!STATUS_VALUES.includes(b.status)) return res.status(400).json({ error: "invalid_status" });
    await pool.query("UPDATE submissions SET status=$1 WHERE id=$2", [b.status, req.params.id]);
    res.json({ ok: true });
  })
);

// ---- submissions: jury score (jury or organizer, one row per juror) ----
app.put(
  "/api/submissions/:id/score",
  asyncRoute(async (req, res) => {
    const session = requireRole(req, SESSION_SECRET, ["jury", "organizer"]);
    const b = req.body || {};
    const keys = ["idea", "english", "originality", "design", "digital"];
    const vals = keys.map((k) => Number(b[k]));
    if (vals.some((v) => !Number.isInteger(v) || v < 0 || v > 20)) {
      return res.status(400).json({ error: "scores must be integers 0..20" });
    }
    await pool.query(
      `INSERT INTO scores(submission_id,jury_user_id,idea,english,originality,design,digital) VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(submission_id,jury_user_id) DO UPDATE SET
         idea=excluded.idea, english=excluded.english, originality=excluded.originality,
         design=excluded.design, digital=excluded.digital`,
      [req.params.id, String(session.uid), ...vals]
    );
    res.json({ ok: true, total: vals.reduce((a, v) => a + v, 0) });
  })
);

// ---- submissions: audience reaction (public) ----
app.post(
  "/api/submissions/:id/reaction",
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      "UPDATE submissions SET audience_count=audience_count+1 WHERE id=$1 RETURNING audience_count",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, audience: rows[0].audience_count });
  })
);

// ---- results: public aggregate across jurors, no per-juror breakdown ----
app.get(
  "/api/results",
  asyncRoute(async (req, res) => {
    const revealed = await namesRevealed();
    const nameCols = revealed ? `s.author, s.group_name as "group",` : "";
    const { rows } = await pool.query(
      `SELECT s.id, s.poster_no as "posterNo", s.title, ${nameCols} s.status,
              COUNT(sc.id)::int as "juryCount",
              COALESCE(AVG(sc.idea+sc.english+sc.originality+sc.design+sc.digital),0)::float as total
       FROM submissions s
       LEFT JOIN scores sc ON sc.submission_id = s.id
       WHERE s.status IN ('published','winner')
       GROUP BY s.id
       ORDER BY total DESC`
    );
    res.json({ results: rows, namesRevealed: revealed });
  })
);

// ---- poster image upload (public — tied to a submission id the participant just received) ----
app.post(
  "/api/upload/:id",
  express.raw({ type: () => true, limit: "10mb" }),
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query("SELECT id FROM submissions WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    const type = req.headers["content-type"] || "application/octet-stream";
    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0 || file.length > 10 * 1024 * 1024 || !ALLOWED_IMAGE_TYPES.includes(type)) {
      return res.status(400).json({ error: "poster must be PNG/JPEG/WEBP up to 10MB" });
    }
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const blob = await blobPut(`posters/${req.params.id}.${ext}`, file, {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
    });
    await pool.query("UPDATE submissions SET image_key=$1 WHERE id=$2", [blob.url, req.params.id]);
    res.json({ ok: true, key: blob.url });
  })
);

// Poster images are served directly from their Vercel Blob URL (stored in
// image_key), so there is no separate /api/posters/:id route here — the
// frontend's asset() helper is unaffected either way since image_key is a
// full URL now, not a local path.

app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

export default app;
