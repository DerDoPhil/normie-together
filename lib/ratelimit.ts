import { query } from "./db/client";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5;

/**
 * Rate limit check: 5 requests per 60 seconds per IP.
 * Atomic Postgres UPSERT increments the counter and returns the new value.
 *
 * @param ip Request IP address
 * @returns true if within limit, false if rate limited
 */
export async function rateLimit(ip: string): Promise<boolean> {
  const windowStart = new Date(
    Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS
  ).toISOString();

  // Best-effort housekeeping so the table stays small.
  await query(`delete from rate_hits where window_start < $1`, [windowStart]);

  // Atomic upsert returning the new count.
  const rows = await query<{ count: number }>(
    `insert into rate_hits (ip, window_start, count)
     values ($1, $2, 1)
     on conflict (ip, window_start) do update set count = rate_hits.count + 1
     returning count`,
    [ip, windowStart]
  );

  return Number(rows[0]?.count ?? 0) <= MAX_REQUESTS;
}
