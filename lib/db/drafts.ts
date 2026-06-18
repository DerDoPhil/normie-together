import { randomUUID } from "crypto";
import { query } from "./client";

export interface Draft {
  id: string;
  sessionId: string;
  nickname: string;
  target: Uint8Array;
  /** Optional ETH address the painter supplied to receive a tip. */
  tipAddress: string | null;
  createdAt: Date;
}

interface DraftRow {
  id: string;
  session_id: string;
  nickname: string;
  target_bitmap: Buffer;
  tip_address: string | null;
  created_at: string | Date;
}

function toDraft(r: DraftRow): Draft {
  return {
    id: r.id,
    sessionId: r.session_id,
    nickname: r.nickname,
    target: new Uint8Array(r.target_bitmap),
    tipAddress: r.tip_address ?? null,
    createdAt: new Date(r.created_at),
  };
}

/**
 * Add a draft design to a session.
 * @returns Draft with auto-generated id and created_at = now()
 * @throws {Error} If draft creation fails
 */
export async function addDraft(p: {
  sessionId: string;
  nickname: string;
  target: Uint8Array;
  tipAddress?: string | null;
}): Promise<Draft> {
  const id = randomUUID();
  const rows = await query<DraftRow>(
    `insert into drafts (id, session_id, nickname, target_bitmap, tip_address)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [id, p.sessionId, p.nickname, Buffer.from(p.target), p.tipAddress ?? null]
  );

  if (rows.length === 0) {
    throw new Error(`Failed to add draft to session ${p.sessionId}`);
  }
  return toDraft(rows[0]);
}

/**
 * List all drafts for a session (ordered by creation time).
 */
export async function listDrafts(sessionId: string): Promise<Draft[]> {
  const rows = await query<DraftRow>(
    `select * from drafts where session_id = $1 order by created_at asc`,
    [sessionId]
  );
  return rows.map(toDraft);
}

/**
 * Count drafts in a session.
 */
export async function countDrafts(sessionId: string): Promise<number> {
  const rows = await query<{ count: string | number }>(
    `select count(*)::int as count from drafts where session_id = $1`,
    [sessionId]
  );
  return Number(rows[0]?.count ?? 0);
}
