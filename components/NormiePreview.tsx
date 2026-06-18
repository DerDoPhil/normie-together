import { getPixel, PIXELS } from "@/lib/bitmap";

export function NormiePreview({
  bitmap,
  size,
}: {
  bitmap: Uint8Array;
  /** Optional fixed pixel size; omit to fill the container width. */
  size?: number;
}) {
  const cells = [];
  for (let i = 0; i < PIXELS; i++) {
    cells.push(
      <div
        key={i}
        data-pixel
        style={{ background: getPixel(bitmap, i) ? "var(--fg)" : "var(--bg)" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size ?? "100%",
        height: size,
        aspectRatio: "1 / 1",
        display: "grid",
        gridTemplateColumns: "repeat(40, 1fr)",
        gridTemplateRows: "repeat(40, 1fr)",
        imageRendering: "pixelated",
      }}
    >
      {cells}
    </div>
  );
}
