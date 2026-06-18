import { popcount, xorOverlay } from "./bitmap";

export function deviationFromOriginal(original: Uint8Array, target: Uint8Array): number {
  return popcount(xorOverlay(original, target));
}

export function remainingBudget(original: Uint8Array, target: Uint8Array, ap: number): number {
  return Math.max(0, ap - deviationFromOriginal(original, target));
}

export function isApplicable(original: Uint8Array, target: Uint8Array, ap: number): boolean {
  return deviationFromOriginal(original, target) <= ap;
}
