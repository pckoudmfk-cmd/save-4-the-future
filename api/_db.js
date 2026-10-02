// Postgres access for the Vercel deployment. Uses whichever Postgres
// connection string Vercel injects when a Postgres store is connected to
// the project — POSTGRES_URL is what Vercel's own Postgres/Neon integration
// sets, DATABASE_URL is the generic fallback some other providers use.
import pg from "pg";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "No POSTGRES_URL or DATABASE_URL is set. Add a Postgres store to the Vercel project (Storage tab) and it will be injected automatically."
  );
}

export const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && !/localhost|127\.0\.0\.1/.test(connectionString) ? { rejectUnauthorized: false } : false,
  max: 5,
});

// pg.Pool emits 'error' on the pool itself when an idle client hits a
// connection-level problem. Without a listener, Node treats that as an
// uncaught exception and crashes the whole serverless function invocation
// (no response is ever sent) — so this listener is required, not optional.
pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});

let migrated = false;

export async function ensureSchema() {
  if (migrated) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'jury',
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      status TEXT NOT NULL DEFAULT 'moderation',
      audience_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id),
      jury_user_id TEXT NOT NULL,
      idea INTEGER NOT NULL,
      english INTEGER NOT NULL,
      originality INTEGER NOT NULL,
      design INTEGER NOT NULL,
      digital INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(submission_id, jury_user_id)
    );

    -- Small key/value store for admin-controlled site settings, e.g. whether
    -- author names have been revealed publicly (see names_revealed below).
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Poster numbers used to be a random 3-digit pick (100-999); new
    -- submissions now draw a sequential number from this sequence instead,
    -- starting at 1 (see renumberPostersOnce below for the one-time switch
    -- of existing rows onto this same numbering).
    CREATE SEQUENCE IF NOT EXISTS poster_no_seq;
  `);
  await renumberPostersOnce();
  migrated = true;
}

// One-time migration: renumber every existing submission 1, 2, 3... in the
// order it was submitted, and point poster_no_seq at the next free number —
// guarded by a settings flag (not just the in-memory `migrated` above) so it
// runs exactly once across every serverless instance, not once per cold
// start. Safe to run concurrently with new submissions: the old random
// numbers are all >= 100, so the sequential 1..N targets can't collide with
// rows this pass hasn't reached yet. Returns a small report so a caller
// (see the /api/admin/renumber-posters route) can confirm what happened
// instead of having to trust a silent success.
export async function renumberPostersOnce(force) {
  if (!force) {
    const already = await getSetting("poster_no_renumbered", "false");
    if (already === "true") return { ran: false, reason: "already_done" };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT id, poster_no FROM submissions ORDER BY created_at ASC FOR UPDATE");
    const mapping = [];
    for (let i = 0; i < rows.length; i++) {
      await client.query("UPDATE submissions SET poster_no=$1 WHERE id=$2", [i + 1, rows[i].id]);
      mapping.push({ from: rows[i].poster_no, to: i + 1 });
    }
    await client.query("SELECT setval('poster_no_seq', $1, true)", [rows.length]);
    await client.query(
      `INSERT INTO settings(key,value) VALUES('poster_no_renumbered','true')
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    );
    await client.query("COMMIT");
    return { ran: true, count: rows.length, mapping };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Settings are a simple key/value pair, always read/written as strings by
// the caller (e.g. "true"/"false" for a boolean flag like names_revealed).
export async function getSetting(key, fallback) {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key=$1", [key]);
  return rows[0] ? rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings(key,value) VALUES($1,$2)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value]
  );
}
