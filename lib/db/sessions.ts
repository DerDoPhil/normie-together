import { randomUUID } from "crypto";
import { query, execute } from "./client";

export interface Session {
  id: string;
  ownerAddress: string;
  tokenId: bigint;
  original: Uint8Array;
  current: Uint8Array;
  apLimit: number;
  status: "open" | "closed";
  createdAt: Date;
}

interface SessionRow {
  id: string;
  owner_address: string;
  // bigint column → the postgres driver may return a string; BigInt() accepts
  // string | number | bigint.
  token_id: number | bigint | string;
  original_bitmap: Buffer;
  current_bitmap: Buffer;
  ap_limit: number;
  status: "open" | "closed";
  created_at: string | Date;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSession(r: SessionRow): Session {
  return {
    id: r.id,
    ownerAddress: r.owner_address,
    tokenId: BigInt(r.token_id),
    original: new Uint8Array(r.original_bitmap),
    current: new Uint8Array(r.current_bitmap),
    apLimit: r.ap_limit,
    status: r.status,
    createdAt: new Date(r.created_at),
  };
}

/**
 * Create a new session for an NFT owner to share painting access.
 * @returns Session with auto-generated id, status='open', created_at = now()
 * @throws {Error} If session creation fails
 */
export async function createSession(p: {
  ownerAddress: string;
  tokenId: bigint;
  original: Uint8Array;
  current: Uint8Array;
  apLimit: number;
}): Promise<Session> {
  const id = randomUUID();
  const rows = await query<SessionRow>(
    `insert into sessions (id, owner_address, token_id, original_bitmap, current_bitmap, ap_limit)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      id,
      p.ownerAddress.toLowerCase(),
      p.tokenId.toString(),
      Buffer.from(p.original),
      Buffer.from(p.current),
      p.apLimit,
    ]
  );

  if (rows.length === 0) {
    throw new Error("Failed to create session: INSERT returned no row");
  }
  return toSession(rows[0]);
}

/**
 * Retrieve a session by ID.
 * @param id Session UUID
 * @returns Session or null if not found / invalid id
 */
export async function getSession(id: string): Promise<Session | null> {
  if (!id || typeof id !== "string" || !UUID_RE.test(id.trim())) {
    return null;
  }
  const rows = await query<SessionRow>(
    `select * from sessions where id = $1`,
    [id]
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * Close a session (owner removes painter access).
 */
export async function closeSession(id: string): Promise<void> {
  await execute(`update sessions set status = $1 where id = $2`, ["closed", id]);
}

/** The currently-open session for a token, if any (used to avoid duplicates). */
export async function getOpenSessionByToken(
  tokenId: bigint
): Promise<Session | null> {
  const rows = await query<SessionRow>(
    `select * from sessions
     where token_id = $1 and status = 'open'
     order by created_at desc
     limit 1`,
    [tokenId.toString()]
  );
  return rows[0] ? toSession(rows[0]) : null;
}

export type OpenSort = "ap" | "drafts" | "new";

export interface OpenSessionSummary {
  id: string;
  tokenId: bigint;
  ownerAddress: string;
  apLimit: number;
  current: Uint8Array;
  draftCount: number;
  createdAt: Date;
}

interface OpenSummaryRow {
  id: string;
  owner_address: string;
  token_id: number | bigint | string;
  current_bitmap: Buffer;
  ap_limit: number;
  draft_count: number | string;
  created_at: string | Date;
}

/**
 * All open sessions with their draft counts, for the public board.
 * @param sort ap = most editable pixels, drafts = most submissions, new = newest
 */
export async function listOpenSessions(
  sort: OpenSort = "new"
): Promise<OpenSessionSummary[]> {
  // Fixed whitelist — never interpolate user input directly.
  const orderBy =
    sort === "ap"
      ? "s.ap_limit desc"
      : sort === "drafts"
        ? "draft_count desc"
        : "s.created_at desc";

  const rows = await query<OpenSummaryRow>(
    `select s.id, s.owner_address, s.token_id, s.current_bitmap, s.ap_limit,
            s.created_at,
            coalesce(d.cnt, 0)::int as draft_count
     from sessions s
     left join (
       select session_id, count(*) as cnt from drafts group by session_id
     ) d on d.session_id = s.id
     where s.status = 'open'
     order by ${orderBy}`,
    []
  );

  return rows.map((r) => ({
    id: r.id,
    tokenId: BigInt(r.token_id),
    ownerAddress: r.owner_address,
    apLimit: r.ap_limit,
    current: new Uint8Array(r.current_bitmap),
    draftCount: Number(r.draft_count),
    createdAt: new Date(r.created_at),
  }));
}
