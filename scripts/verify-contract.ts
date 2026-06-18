import {
  getOwnerOf, getOriginalBitmap, getCurrentBitmap, getApLimit, isPaused, buildApplyTx,
} from "../lib/normies/contract";
import { popcount, xorOverlay, emptyBitmap } from "../lib/bitmap";

async function findApToken(): Promise<bigint> {
  for (let i = 1; i <= 40; i++) {
    const ap = await getApLimit(BigInt(i));
    if (ap > 0) return BigInt(i);
  }
  return 1n;
}

async function main() {
  const arg = process.argv[2];
  const tokenId = arg ? BigInt(arg) : await findApToken();

  const [owner, original, current, ap, paused] = await Promise.all([
    getOwnerOf(tokenId), getOriginalBitmap(tokenId), getCurrentBitmap(tokenId), getApLimit(tokenId), isPaused(),
  ]);

  console.log("tokenId:", tokenId.toString());
  console.log("owner:", owner);
  console.log("canvas paused:", paused);
  console.log("ap (actionPoints):", ap);
  console.log("original: bytes", original.length, "setBits", popcount(original));
  console.log("current : bytes", current.length, "setBits", popcount(current));
  const dev = popcount(xorOverlay(original, current));
  console.log("current deviation from original:", dev, dev <= ap ? "(<= ap OK)" : "(> ap — UNEXPECTED)");

  const tx = buildApplyTx(tokenId, emptyBitmap());
  console.log("applyTx:", tx.address, tx.functionName, "tokenId", tx.args[0].toString(), "overlayBytes", (tx.args[1].length - 2) / 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
