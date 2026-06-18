import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getOwnedNormies } from "@/lib/normies/owned";
import { getApLimit, getCurrentBitmap } from "@/lib/normies/contract";
import { listOpenSessions } from "@/lib/db/sessions";
import { toB64 } from "@/lib/serialize";

// Cap how many tokens we enrich with contract reads per request.
const MAX_ENRICH = 24;

type OwnedItem = {
  tokenId: string;
  apLimit: number;
  current: string | null; // base64 preview, null if unavailable
  openSessionId: string | null;
  draftCount: number;
};

/**
 * GET /api/owned?address=0x...
 * The Normies held by an address, each with AP, a preview bitmap, and whether
 * it already has an open board. Tokens already open are read from the DB
 * (no contract calls); the rest are read from chain.
 */
export async function GET(req: Request) {
  try {
    const address = new URL(req.url).searchParams.get("address") ?? "";
    if (!isAddress(address)) {
      return NextResponse.json({ error: "invalid address" }, { status: 400 });
    }

    const owned = await getOwnedNormies(address);

    // Map of this owner's currently-open boards by tokenId.
    const open = await listOpenSessions("new");
    const lower = address.toLowerCase();
    const openByToken = new Map(
      open
        .filter((s) => s.ownerAddress.toLowerCase() === lower)
        .map((s) => [s.tokenId.toString(), s])
    );

    const slice = owned.slice(0, MAX_ENRICH);
    const items: OwnedItem[] = await Promise.all(
      slice.map(async (tokenId): Promise<OwnedItem> => {
        const key = tokenId.toString();
        const existing = openByToken.get(key);
        if (existing) {
          return {
            tokenId: key,
            apLimit: existing.apLimit,
            current: toB64(existing.current),
            openSessionId: existing.id,
            draftCount: existing.draftCount,
          };
        }
        // Not opened yet — read AP + current image from chain (fault-tolerant).
        try {
          const [apLimit, current] = await Promise.all([
            getApLimit(tokenId),
            getCurrentBitmap(tokenId),
          ]);
          return {
            tokenId: key,
            apLimit,
            current: toB64(current),
            openSessionId: null,
            draftCount: 0,
          };
        } catch {
          return {
            tokenId: key,
            apLimit: 0,
            current: null,
            openSessionId: null,
            draftCount: 0,
          };
        }
      })
    );

    return NextResponse.json({
      total: owned.length,
      shown: items.length,
      items,
    });
  } catch (err) {
    console.error("GET /api/owned error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
