import { describe, it, expect } from "vitest";
import { emptyBitmap, setPixel } from "./bitmap";
import { deviationFromOriginal, remainingBudget, isApplicable } from "./ap";

describe("ap", () => {
  it("deviation = pixels differing from original", () => {
    const original = emptyBitmap();
    const target = emptyBitmap();
    setPixel(target, 0, 1);
    setPixel(target, 9, 1);
    expect(deviationFromOriginal(original, target)).toBe(2);
  });

  it("remainingBudget = ap - deviation, floored at 0", () => {
    const original = emptyBitmap();
    const target = emptyBitmap();
    setPixel(target, 0, 1);
    expect(remainingBudget(original, target, 5)).toBe(4);
    expect(remainingBudget(original, target, 1)).toBe(0);
    expect(remainingBudget(original, target, 0)).toBe(0);
  });

  it("isApplicable true iff deviation <= ap", () => {
    const original = emptyBitmap();
    const target = emptyBitmap();
    setPixel(target, 0, 1);
    setPixel(target, 1, 1);
    expect(isApplicable(original, target, 2)).toBe(true);
    expect(isApplicable(original, target, 1)).toBe(false);
  });
});
