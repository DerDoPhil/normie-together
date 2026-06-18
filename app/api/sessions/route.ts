import { NextResponse } from "next/server";
import { getOwnerOf, getOriginalBitmap, getCurrentBitmap, getApLimit } from "@/lib/normies/contract";
import {
  createSession,
  getOpenSessionByToken,
  listOpenSessions,
  type OpenSort,
} from "@/lib/db/sessions";
import { toB64 } from "@/lib/serialize";

/**
 * GET /api/sessions?sort=ap|drafts|new
 * Public board: all open Normies with preview bitmap, AP and draft count.
 */
export async function GET(req: Request) {
  try {
    const sortParam = new URL(req.url).searchParams.get("sort");
    const sort: OpenSort =
      sortParam === "ap" || sortParam === "drafts" ? sortParam : "new";

    const sessions = await listOpenSessions(sort);
    return NextResponse.json(
      sessions.map((s) => ({
        id: s.id,
        tokenId: s.tokenId.toString(),
        ownerAddress: s.ownerAddress,
        apLimit: s.apLimit,
        draftCount: s.draftCount,
        current: toB64(s.current),
        createdAt: s.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { ownerAddress, tokenId } = await req.json();

    // Validate inputs
    if (!ownerAddress || tokenId === undefined) {
      return NextResponse.json(
        { error: "missing required fields: ownerAddress, tokenId" },
        { status: 400 }
      );
    }

    // Parse tokenId as bigint
    let id: bigint;
    try {
      id = BigInt(tokenId);
    } catch {
      return NextResponse.json(
        { error: "tokenId must be a valid integer" },
        { status: 400 }
      );
    }

    // Verify ownership: on-chain owner must match request ownerAddress (case-insensitive)
    const onchainOwner = await getOwnerOf(id);
    if (onchainOwner.toLowerCase() !== String(ownerAddress).toLowerCase()) {
      return NextResponse.json(
        { error: "not token owner" },
        { status: 403 }
      );
    }

    // Dedup: if this token already has an open board, return it instead of
    // creating a duplicate.
    const existing = await getOpenSessionByToken(id);
    if (existing) {
      return NextResponse.json(
        {
          id: existing.id,
          tokenId: existing.tokenId.toString(),
          apLimit: existing.apLimit,
          status: existing.status,
        },
        { status: 200 }
      );
    }

    // Fetch token data from contract
    const [original, current, apLimit] = await Promise.all([
      getOriginalBitmap(id),
      getCurrentBitmap(id),
      getApLimit(id),
    ]);

    // Create session in database
    const session = await createSession({
      ownerAddress,
      tokenId: id,
      original,
      current,
      apLimit,
    });

    // Return session info (not full bitmap, to keep payload small)
    return NextResponse.json(
      {
        id: session.id,
        tokenId: session.tokenId.toString(),
        apLimit: session.apLimit,
        status: session.status,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json(
      { error: "failed to create session" },
      { status: 500 }
    );
  }
}
