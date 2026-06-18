export const BITMAP_BYTES = 200;
export const PIXELS = 1600;

export function emptyBitmap(): Uint8Array {
  return new Uint8Array(BITMAP_BYTES);
}

export function isValidBitmap(b: Uint8Array): boolean {
  return b instanceof Uint8Array && b.length === BITMAP_BYTES;
}

function assertIndex(i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= PIXELS) {
    throw new RangeError(`pixel index out of range: ${i}`);
  }
}

export function getPixel(b: Uint8Array, i: number): 0 | 1 {
  assertIndex(i);
  const byte = b[i >> 3];
  return ((byte >> (7 - (i & 7))) & 1) as 0 | 1;
}

export function setPixel(b: Uint8Array, i: number, v: 0 | 1): void {
  assertIndex(i);
  const mask = 1 << (7 - (i & 7));
  if (v) b[i >> 3] |= mask;
  else b[i >> 3] &= ~mask;
}

export function togglePixel(b: Uint8Array, i: number): void {
  assertIndex(i);
  b[i >> 3] ^= 1 << (7 - (i & 7));
}

export function xorOverlay(a: Uint8Array, c: Uint8Array): Uint8Array {
  const out = emptyBitmap();
  for (let k = 0; k < BITMAP_BYTES; k++) out[k] = a[k] ^ c[k];
  return out;
}

export function popcount(b: Uint8Array): number {
  let n = 0;
  for (let k = 0; k < b.length; k++) {
    let x = b[k];
    while (x) { x &= x - 1; n++; }
  }
  return n;
}
