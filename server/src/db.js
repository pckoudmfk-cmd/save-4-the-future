"use strict";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "db.sqlite3");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Accounts for jury members and organizers/admins. Participants do not have
// accounts: they submit through the public form and are identified only by
// the fields they fill in.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'jury', -- 'jury' | 'organizer'
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  poster_no INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  idea TEXT NOT NULL,
  problem TEXT,
  author TEXT,
  group_name TEXT,
  contact TEXT,
  tools TEXT,
  ai_how TEXT NOT NULL,
  contribution TEXT,
  interactive INTEGER NOT NULL DEFAULT 0,
  interactive_url TEXT,
  image_key TEXT,
  image_type TEXT,
  status TEXT NOT NULL DEFAULT 'moderation', -- 'moderation' | 'published' | 'rework' | 'rejected' | 'winner'
  audience_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per (submission, juror): a juror can score a poster once and can
-- update their own score, but never sees or overwrites another juror's row.
-- Individual scores are never exposed through the API; only the aggregate
-- in /api/results is public.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  jury_user_id TEXT NOT NULL,
  idea INTEGER NOT NULL,
  english INTEGER NOT NULL,
  originality INTEGER NOT NULL,
  design INTEGER NOT NULL,
  digital INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, jury_user_id),
  FOREIGN KEY(submission_id) REFERENCES submissions(id)
);
`);

module.exports = { db, UPLOADS_DIR, DATA_DIR };
