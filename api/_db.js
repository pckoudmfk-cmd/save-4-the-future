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
  `);
  migrated = true;
}
