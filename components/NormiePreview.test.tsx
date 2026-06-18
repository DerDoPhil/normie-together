import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { emptyBitmap, setPixel } from "@/lib/bitmap";
import { NormiePreview } from "./NormiePreview";

describe("NormiePreview", () => {
  it("renders a 40x40 grid of 1600 cells", () => {
    const b = emptyBitmap();
    setPixel(b, 0, 1);
    const { container } = render(<NormiePreview bitmap={b} />);
    expect(container.querySelectorAll("[data-pixel]").length).toBe(1600);
  });
});
