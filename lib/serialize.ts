/**
 * Bitmap ↔ Base64 conversion for JSON transport.
 * Serializes Uint8Array to base64 string and vice versa.
 */

/**
 * Convert a Uint8Array to a base64-encoded string.
 * @param b Bitmap bytes
 * @returns Base64-encoded string representation
 */
export function toB64(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

/**
 * Convert a base64-encoded string back to a Uint8Array.
 * @param s Base64-encoded string
 * @returns Decoded bitmap bytes
 * @throws {Error} If the base64 string is invalid
 */
export function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
