import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { emptyBitmap } from "@/lib/bitmap";
import { PixelEditor } from "./PixelEditor";

describe("PixelEditor", () => {
  it("toggling a pixel calls onChange with updated bitmap", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PixelEditor
        original={emptyBitmap()}
        initial={emptyBitmap()}
        apLimit={10}
        onChange={onChange}
      />
    );
    const first = container.querySelector("[data-pixel-index='0']")!;
    fireEvent.click(first);
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0] as Uint8Array;
    expect(arg[0]).toBe(0b1000_0000);
  });

  it("blocks a toggle that would exceed AP budget", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PixelEditor
        original={emptyBitmap()}
        initial={emptyBitmap()}
        apLimit={0}
        onChange={onChange}
      />
    );
    fireEvent.click(container.querySelector("[data-pixel-index='0']")!);
    expect(onChange).not.toHaveBeenCalled(); // budget 0 -> cannot add deviation
  });
});
