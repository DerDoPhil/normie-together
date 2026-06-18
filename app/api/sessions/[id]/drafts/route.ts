import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getSession } from "@/lib/db/sessions";
import { addDraft, listDrafts, countDrafts } from "@/lib/db/drafts";
import { isApplicable } from "@/lib/ap";
import { isValidBitmap } from "@/lib/bitmap";
import { fromB64, toB64 } from "@/lib/serialize";
import { rateLimit } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ id: string }> };
const MAX_DRAFTS_PER_SESSION = 50;

/**
 * GET /api/sessions/[id]/drafts
 * List all drafts for a session (ordered by creation time).
 *
 * Returns:
 * - 200: Array of drafts with base64-encoded bitmaps
 * - 404: Session not found
 * - 500: Server error
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  try {
    const s = await getSession(id);
    if (!s) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const drafts = await listDrafts(id);
    return NextResponse.json(
      drafts.map((d) => ({
        id: d.id,
        nickname: d.nickname,
        target: toB64(d.target),
        tipAddress: d.tipAddress,
        createdAt: d.createdAt,
      }))
    );
  } catch (err) {
    console.error(`GET /api/sessions/${id}/drafts error:`, err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/**
 * POST /api/sessions/[id]/drafts
 * Add a new draft design (with AP enforcement and rate limiting).
 *
 * Request body: { nickname: string, target: base64 Uint8Array, tipAddress?: string }
 * Returns: { id: string } on success
 *
 * Status codes:
 * - 200: Draft added successfully
 * - 400: Missing/invalid fields, bad bitmap, or invalid tip address
 * - 404: Session not found
 * - 409: Session closed or too many drafts
 * - 422: Exceeds AP budget
 * - 429: Rate limited
 * - 500: Server error
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;

  try {
    // Rate limiting: extract IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await rateLimit(ip))) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }

    // Fetch session
    const s = await getSession(id);
    if (!s) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Check session is open
    if (s.status !== "open") {
      return NextResponse.json({ error: "session closed" }, { status: 409 });
    }

    // Check draft capacity
    if ((await countDrafts(id)) >= MAX_DRAFTS_PER_SESSION) {
      return NextResponse.json({ error: "session full" }, { status: 409 });
    }

    // Parse request
    const { nickname, target: targetB64, tipAddress: rawTip } = await req.json();

    // Validate nickname
    if (
      !nickname ||
      typeof nickname !== "string" ||
      nickname.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "nickname required" },
        { status: 400 }
      );
    }

    // Validate optional tip address: empty/absent → null; otherwise must be a
    // valid EVM address (stored checksummed).
    let tipAddress: string | null = null;
    if (rawTip !== undefined && rawTip !== null && String(rawTip).trim() !== "") {
      const candidate = String(rawTip).trim();
      if (!isAddress(candidate)) {
        return NextResponse.json(
          { error: "invalid tip address" },
          { status: 400 }
        );
      }
      tipAddress = getAddress(candidate);
    }

    // Decode bitmap from base64
    let bitmap: Uint8Array;
    try {
      bitmap = fromB64(targetB64);
    } catch (err) {
      return NextResponse.json(
        { error: "bad bitmap encoding" },
        { status: 400 }
      );
    }

    // Validate bitmap
    if (!isValidBitmap(bitmap)) {
      return NextResponse.json({ error: "invalid bitmap" }, { status: 400 });
    }

    // Enforce AP budget
    if (!isApplicable(s.original, bitmap, s.apLimit)) {
      return NextResponse.json(
        { error: "exceeds AP budget" },
        { status: 422 }
      );
    }

    // Add draft to database
    const draft = await addDraft({ sessionId: id, nickname, target: bitmap, tipAddress });

    return NextResponse.json({ id: draft.id }, { status: 200 });
  } catch (err) {
    console.error(`POST /api/sessions/${id}/drafts error:`, err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
