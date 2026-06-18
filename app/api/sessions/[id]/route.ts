import { NextResponse } from "next/server";
import { getSession, closeSession } from "@/lib/db/sessions";
import { getOwnerOf } from "@/lib/normies/contract";
import { toB64 } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/[id]
 * Retrieve session details with bitmaps (base64-encoded).
 *
 * Returns:
 * - 200: Session details with base64-encoded original and current bitmaps
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

    return NextResponse.json({
      id: s.id,
      tokenId: s.tokenId.toString(),
      apLimit: s.apLimit,
      status: s.status,
      original: toB64(s.original),
      current: toB64(s.current),
    });
  } catch (err) {
    console.error(`GET /api/sessions/${id} error:`, err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/[id]
 * Close session (owner-only). Requires ownerAddress in request body for verification.
 *
 * Request body: { ownerAddress: string }
 * Returns:
 * - 200: Session closed successfully
 * - 400: Missing ownerAddress
 * - 403: Not the token owner
 * - 404: Session not found
 * - 500: Server error
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;

  try {
    const { ownerAddress } = await req.json();

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "missing ownerAddress" },
        { status: 400 }
      );
    }

    const s = await getSession(id);
    if (!s) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Verify owner by fetching current on-chain owner and comparing
    const owner = await getOwnerOf(s.tokenId);
    if (owner.toLowerCase() !== String(ownerAddress).toLowerCase()) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Close the session
    await closeSession(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`PATCH /api/sessions/${id} error:`, err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
