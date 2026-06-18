import postgres from "postgres";

/*
  Postgres (Supabase) data client.

  Runs on Vercel serverless, so we connect through the Supabase transaction
  pooler (pgbouncer). That mode does not support prepared statements, hence
  `prepare: false`. The connection is a lazy singleton and the schema is created
  on first access (idempotent), so cold starts self-heal with no migration step.
*/

const DATABASE_URL = process.env.DATABASE_URL;

// Each table as its own statement (run individually for pooler compatibility).
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY,
    owner_address text NOT NULL,
    token_id bigint NOT NULL,
    original_bitmap bytea NOT NULL,
    current_bitmap bytea NOT NULL,
    ap_limit integer NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS drafts (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    nickname text NOT NULL,
    target_bitmap bytea NOT NULL,
    tip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_drafts_session_id ON drafts(session_id)`,
  `CREATE TABLE IF NOT EXISTS rate_hits (
    ip text NOT NULL,
    window_start timestamptz NOT NULL,
    count integer NOT NULL DEFAULT 0,
    PRIMARY KEY (ip, window_start)
  )`,
];

type Sql = ReturnType<typeof postgres>;

let _sql: Sql | null = null;

/** Lazily-opened pooled Postgres connection. */
export function getSql(): Sql {
  if (!_sql) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    _sql = postgres(DATABASE_URL, {
      prepare: false, // Supabase transaction pooler (pgbouncer)
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {}, // suppress idempotent-migration NOTICEs
    });
  }
  return _sql;
}

/** Close the pool (tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
  schemaReady = null;
}

// Memoize schema init so it runs exactly once per process.
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initializeSchema();
  return schemaReady;
}

/**
 * Create the schema (idempotent) and apply additive migrations.
 * Uses the raw connection directly to avoid recursing through ensureSchema().
 * @throws on SQL failure
 */
export async function initializeSchema(): Promise<void> {
  const sql = getSql();
  try {
    for (const stmt of SCHEMA_STATEMENTS) {
      await sql.unsafe(stmt);
    }
    // Additive migration for databases created by an older schema.
    await sql.unsafe(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS tip_address text`);
  } catch (err) {
    console.error("Database schema initialization failed:", err);
    throw err;
  }
}

/**
 * Execute a query and return all rows. Uses $1-style placeholders.
 * @param text SQL with $1, $2, … placeholders
 * @param params Query parameters
 */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await getSql().unsafe(text, params as any[]);
  return rows as unknown as T[];
}

/**
 * Execute a query returning a single row (or undefined).
 */
export async function queryOne<T>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/**
 * Execute a write (INSERT/UPDATE/DELETE).
 * @returns { count } affected-row count
 */
export async function execute(
  text: string,
  params: unknown[] = []
): Promise<{ count: number }> {
  await ensureSchema();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getSql().unsafe(text, params as any[]);
  return { count: res.count ?? 0 };
}

/**
 * Initialize the schema once (callable from app startup or tests).
 * Idempotent and safe for concurrent callers.
 */
export async function ensureDbInitialized(): Promise<void> {
  await ensureSchema();
}
