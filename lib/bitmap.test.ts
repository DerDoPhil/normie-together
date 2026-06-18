import { describe, it, expect } from "vitest";
import {
  BITMAP_BYTES, PIXELS, getPixel, setPixel, togglePixel,
  xorOverlay, popcount, isValidBitmap, emptyBitmap,
} from "./bitmap";

describe("bitmap", () => {
  it("constants are 200 bytes / 1600 pixels", () => {
    expect(BITMAP_BYTES).toBe(200);
    expect(PIXELS).toBe(1600);
  });

  it("emptyBitmap is 200 zero bytes", () => {
    const b = emptyBitmap();
    expect(b.length).toBe(200);
    expect([...b].every((x) => x === 0)).toBe(true);
  });

  it("set then get a pixel (MSB-first within byte)", () => {
    const b = emptyBitmap();
    setPixel(b, 0, 1);
    expect(getPixel(b, 0)).toBe(1);
    expect(b[0]).toBe(0b1000_0000);
    setPixel(b, 7, 1);
    expect(b[0]).toBe(0b1000_0001);
  });

  it("toggle flips a pixel", () => {
    const b = emptyBitmap();
    togglePixel(b, 5);
    expect(getPixel(b, 5)).toBe(1);
    togglePixel(b, 5);
    expect(getPixel(b, 5)).toBe(0);
  });

  it("xorOverlay produces flips between two bitmaps", () => {
    const a = emptyBitmap();
    const c = emptyBitmap();
    setPixel(c, 3, 1);
    setPixel(c, 100, 1);
    const o = xorOverlay(a, c);
    expect(getPixel(o, 3)).toBe(1);
    expect(getPixel(o, 100)).toBe(1);
    expect(popcount(o)).toBe(2);
  });

  it("popcount counts set bits", () => {
    const b = emptyBitmap();
    [0, 1, 2, 1599].forEach((i) => setPixel(b, i, 1));
    expect(popcount(b)).toBe(4);
  });

  it("isValidBitmap rejects wrong size", () => {
    expect(isValidBitmap(new Uint8Array(200))).toBe(true);
    expect(isValidBitmap(new Uint8Array(199))).toBe(false);
  });

  it("out-of-range pixel index throws", () => {
    const b = emptyBitmap();
    expect(() => setPixel(b, 1600, 1)).toThrow();
    expect(() => getPixel(b, -1)).toThrow();
  });
});
