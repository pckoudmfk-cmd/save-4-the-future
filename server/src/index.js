"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { db, UPLOADS_DIR } = require("./db");
const {
  hashPassword,
  verifyPassword,
  createSessionCookie,
  verifySession,
  requireRole,
  CLEAR_SESSION_COOKIE,
  HttpError,
} = require("./auth");

const PORT = Number(process.env.PORT) || 8787;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SETUP_KEY = process.env.SETUP_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is not set. Copy server/.env.example to server/.env, fill it in, and restart."
  );
  process.exit(1);
}

// Public/anonymized column list — never includes author, group_name or contact.
const PUBLIC_COLUMNS = [
  "id", "poster_no", "title", "idea", "problem", "tools", "ai_how",
  "contribution", "interactive", "interactive_url", "image_key", "status",
  "audience_count", "created_at",
];
const ALL_COLUMNS = [
  "id", "poster_no", "title", "idea", "problem", "author", "group_name",
  "contact", "tools", "ai_how", "contribution", "interactive",
  "interactive_url", "image_key", "status", "audience_count", "created_at",
];
const STATUS_VALUES = ["published", "rework", "rejected", "winner"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind nginx/another reverse proxy

// ---- CORS: reflect the request Origin against the allowlist, credentials-aware ----
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

app.get("/health", (req, res) => res.json({ ok: true, service: "save-the-future-api" }));

// JSON body everywhere except the raw image upload route.
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

// ---- one-time bootstrap: create the first organizer account ----
app.post(
  "/api/setup",
  asyncRoute(async (req, res) => {
    if (!SETUP_KEY || req.headers["x-setup-key"] !== SETUP_KEY) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const count = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    if (count > 0) return res.status(409).json({ error: "already_initialized" });
    const b = req.body || {};
    if (!b.username || !b.password) return res.status(400).json({ error: "username and password are required" });
    const hash = hashPassword(String(b.password));
    db.prepare("INSERT INTO users(username,password_hash,role,display_name) VALUES(?,?,'organizer',?)").run(
      String(b.username),
      hash,
      b.displayName || String(b.username)
    );
    res.status(201).json({ ok: true });
  })
);

// ---- auth ----
app.post(
  "/api/login",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    if (!b.username || !b.password) return res.status(400).json({ error: "username and password are required" });
    const user = db
      .prepare("SELECT id,username,password_hash,role,display_name FROM users WHERE username=?")
      .get(String(b.username));
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

// ---- admin: manage jury/organizer accounts ----
app.get(
  "/api/admin/users",
  asyncRoute(async (req, res) => {
    requireRole(req, SESSION_SECRET, ["organizer"]);
    const users = db.prepare("SELECT id,username,role,display_name,created_at FROM users ORDER BY created_at DESC").all();
    res.json({ users });
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
      db.prepare("INSERT INTO users(username,password_hash,role,display_name) VALUES(?,?,?,?)").run(
        String(b.username),
        hash,
        role,
        b.displayName || String(b.username)
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
    const cols = (isOrganizer ? ALL_COLUMNS : PUBLIC_COLUMNS).join(",");
    const sql = isOrganizer
      ? `SELECT ${cols} FROM submissions ORDER BY created_at DESC`
      : `SELECT ${cols} FROM submissions WHERE status IN ('published','winner') ORDER BY created_at DESC`;
    const submissions = db.prepare(sql).all();
    res.json({ submissions });
  })
);

// ---- submissions: single ----
app.get(
  "/api/submissions/:id",
  asyncRoute(async (req, res) => {
    const session = verifySession(req, SESSION_SECRET);
    const isOrganizer = !!session && session.role === "organizer";
    const cols = (isOrganizer ? ALL_COLUMNS : PUBLIC_COLUMNS).join(",");
    const sql = isOrganizer
      ? `SELECT ${cols} FROM submissions WHERE id=?`
      : `SELECT ${cols} FROM submissions WHERE id=? AND status IN ('published','winner')`;
    const row = db.prepare(sql).get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  })
);

// ---- submissions: create (public — participants have no accounts) ----
app.post(
  "/api/submissions",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.idea || !b.aiHow) {
      return res.status(400).json({ error: "title, idea and aiHow are required" });
    }
    const id = crypto.randomUUID();
    const posterNo = Math.floor(100 + Math.random() * 900);
    db.prepare(
      `INSERT INTO submissions(id,poster_no,title,idea,problem,author,group_name,contact,tools,ai_how,contribution,interactive,interactive_url,status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'moderation')`
    ).run(
      id,
      posterNo,
      String(b.title),
      String(b.idea),
      b.problem || "",
      b.author || "",
      b.group || "",
      b.contact || "",
      b.tools || "",
      String(b.aiHow),
      b.contribution || "",
      b.interactiveUrl ? 1 : 0,
      b.interactiveUrl || ""
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
    db.prepare("UPDATE submissions SET status=? WHERE id=?").run(b.status, req.params.id);
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
    db.prepare(
      `INSERT INTO scores(submission_id,jury_user_id,idea,english,originality,design,digital) VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(submission_id,jury_user_id) DO UPDATE SET
         idea=excluded.idea, english=excluded.english, originality=excluded.originality,
         design=excluded.design, digital=excluded.digital`
    ).run(req.params.id, String(session.uid), ...vals);
    res.json({ ok: true, total: vals.reduce((a, v) => a + v, 0) });
  })
);

// ---- submissions: audience reaction (public) ----
app.post(
  "/api/submissions/:id/reaction",
  asyncRoute(async (req, res) => {
    db.prepare("UPDATE submissions SET audience_count=audience_count+1 WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  })
);

// ---- results: public aggregate across jurors, no per-juror breakdown ----
app.get(
  "/api/results",
  asyncRoute(async (req, res) => {
    const results = db
      .prepare(
        `SELECT s.id, s.poster_no as posterNo, s.title, s.status,
                COUNT(sc.id) as juryCount,
                COALESCE(AVG(sc.idea+sc.english+sc.originality+sc.design+sc.digital),0) as total
         FROM submissions s
         LEFT JOIN scores sc ON sc.submission_id = s.id
         WHERE s.status IN ('published','winner')
         GROUP BY s.id
         ORDER BY total DESC`
      )
      .all();
    res.json({ results });
  })
);

// ---- poster image upload (public — tied to a submission id the participant just received) ----
app.post(
  "/api/upload/:id",
  express.raw({ type: () => true, limit: "10mb" }),
  asyncRoute(async (req, res) => {
    const s = db.prepare("SELECT id FROM submissions WHERE id=?").get(req.params.id);
    if (!s) return res.status(404).json({ error: "not_found" });
    const type = req.headers["content-type"] || "application/octet-stream";
    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0 || file.length > 10 * 1024 * 1024 || !ALLOWED_IMAGE_TYPES.includes(type)) {
      return res.status(400).json({ error: "poster must be PNG/JPEG/WEBP up to 10MB" });
    }
    const key = `posters/${req.params.id}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, req.params.id), file);
    db.prepare("UPDATE submissions SET image_key=?, image_type=? WHERE id=?").run(key, type, req.params.id);
    res.json({ ok: true, key });
  })
);

// ---- poster image serving (public) ----
app.get("/api/posters/:id", (req, res) => {
  const row = db.prepare("SELECT image_key, image_type FROM submissions WHERE id=?").get(req.params.id);
  const filePath = path.join(UPLOADS_DIR, req.params.id);
  if (!row || !row.image_key || !fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.setHeader("Content-Type", row.image_type || "application/octet-stream");
  res.setHeader("Cache-Control", "public,max-age=3600");
  fs.createReadStream(filePath).pipe(res);
});

app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.listen(PORT, () => {
  console.log(`save-the-future API listening on port ${PORT}`);
});
