import {
  createPublicClient, http, hexToBytes, bytesToHex, getAddress,
  type Address, type Hex,
} from "viem";
import {
  CHAIN, NORMIES_NFT, NORMIES_CANVAS, ORIGINAL_STORAGE, TRANSFORM_STORAGE,
} from "./addresses";
import { BITMAP_BYTES, emptyBitmap, xorOverlay } from "../bitmap";

// Server-side RPC (Alchemy). Reads only; the apply write is signed client-side via wagmi.
const RPC_URL = process.env.ETH_RPC_URL ?? process.env.NEXT_PUBLIC_ETH_RPC_URL;

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

// Minimal ABIs — only the functions this app calls. Verified against the on-chain
// contracts on 2026-06-16 (see docs/superpowers/specs).
const NFT_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const ORIGINAL_STORAGE_ABI = [
  { type: "function", name: "getTokenRawImageData", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "bytes" }] },
] as const;

const TRANSFORM_STORAGE_ABI = [
  { type: "function", name: "getTransformedImageData", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "bytes" }] },
  { type: "function", name: "isTransformed", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const CANVAS_ABI = [
  { type: "function", name: "actionPoints", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view",
    inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "delegates", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "setTransformBitmap", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "bitmap", type: "bytes" }], outputs: [] },
] as const;

function toBitmap(hex: Hex): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length !== BITMAP_BYTES) {
    throw new Error(`expected ${BITMAP_BYTES}-byte bitmap, got ${bytes.length}`);
  }
  return bytes;
}

/** Current on-chain owner of the token. */
export async function getOwnerOf(tokenId: bigint): Promise<Address> {
  const owner = await publicClient.readContract({
    address: NORMIES_NFT, abi: NFT_ABI, functionName: "ownerOf", args: [tokenId],
  });
  return getAddress(owner);
}

/** 200-byte original mint image. */
export async function getOriginalBitmap(tokenId: bigint): Promise<Uint8Array> {
  const hex = await publicClient.readContract({
    address: ORIGINAL_STORAGE, abi: ORIGINAL_STORAGE_ABI,
    functionName: "getTokenRawImageData", args: [tokenId],
  });
  return toBitmap(hex);
}

/** 200-byte current transform overlay (relative to original), or all-zero if none set. */
async function getOverlay(tokenId: bigint): Promise<Uint8Array> {
  const transformed = await publicClient.readContract({
    address: TRANSFORM_STORAGE, abi: TRANSFORM_STORAGE_ABI,
    functionName: "isTransformed", args: [tokenId],
  });
  if (!transformed) return emptyBitmap();
  const hex = await publicClient.readContract({
    address: TRANSFORM_STORAGE, abi: TRANSFORM_STORAGE_ABI,
    functionName: "getTransformedImageData", args: [tokenId],
  });
  return toBitmap(hex);
}

/** 200-byte currently displayed image = original XOR overlay (on-chain `_composite`). */
export async function getCurrentBitmap(tokenId: bigint): Promise<Uint8Array> {
  const [original, overlay] = await Promise.all([getOriginalBitmap(tokenId), getOverlay(tokenId)]);
  return xorOverlay(original, overlay);
}

/** AP limit = max number of pixels the overlay may flip vs. the original. */
export async function getApLimit(tokenId: bigint): Promise<number> {
  const ap = await publicClient.readContract({
    address: NORMIES_CANVAS, abi: CANVAS_ABI, functionName: "actionPoints", args: [tokenId],
  });
  return Number(ap);
}

/** Whether the Canvas contract is globally paused (setTransformBitmap reverts when true). */
export async function isPaused(): Promise<boolean> {
  return publicClient.readContract({
    address: NORMIES_CANVAS, abi: CANVAS_ABI, functionName: "paused",
  });
}

/** wagmi writeContract config to apply an overlay (= targetImage XOR original) on-chain. */
export function buildApplyTx(tokenId: bigint, overlay: Uint8Array) {
  if (overlay.length !== BITMAP_BYTES) {
    throw new Error(`overlay must be ${BITMAP_BYTES} bytes, got ${overlay.length}`);
  }
  return {
    address: NORMIES_CANVAS as Address,
    abi: CANVAS_ABI,
    functionName: "setTransformBitmap" as const,
    args: [tokenId, bytesToHex(overlay)] as const,
  };
}
