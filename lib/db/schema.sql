-- Reference schema (Postgres / Supabase). The app applies this automatically on
-- first DB access via lib/db/client.ts; this file mirrors it for documentation.

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  owner_address text NOT NULL,
  token_id bigint NOT NULL,
  original_bitmap bytea NOT NULL,
  current_bitmap bytea NOT NULL,
  ap_limit integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  target_bitmap bytea NOT NULL,
  tip_address text,            -- optional ETH address for an opt-in tip
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drafts_session_id ON drafts(session_id);

CREATE TABLE IF NOT EXISTS rate_hits (
  ip text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, window_start)
);
