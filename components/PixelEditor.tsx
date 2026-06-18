"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPixel, setPixel as setBit, emptyBitmap, PIXELS } from "@/lib/bitmap";
import { ApBudgetMeter } from "./ApBudgetMeter";

// Canvas pixel editor — drawing engine ported from DoPhil's Normie Hunter
// (draw/erase/circle/square, swipe-paint, image overlay, pinch-zoom/pan),
// adapted to CommunityCanvas's 1-bit bitmap + AP budget, and fully responsive
// (mouse + touch). Colours match the normies.art monochrome palette.

const SZ = 40;
const INK = "#48494b"; // normies dark grey (a "set" pixel)
const BG = "#e3e5e4"; // normies light grey (an "unset" pixel)

type Tool = "draw" | "erase" | "circle" | "square";

type Overlay = {
  img: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  locked: boolean;
};

type Active =
  | { type: "paint"; erase: boolean }
  | { type: "shape"; kind: "circle" | "square"; sx: number; sy: number }
  | { type: "overlay"; sx: number; sy: number; ox: number; oy: number }
  | { type: "pinch" }
  | null;

type Snapshot = {
  pixels: Uint8Array;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  preview: Set<number> | null;
  overlay: Overlay | null;
};

type Ptr = React.MouseEvent | React.TouchEvent;

/** Unpack a packed 200-byte bitmap to a 1600-entry 0/1 array. */
function unpack(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(PIXELS);
  for (let i = 0; i < PIXELS; i++) out[i] = getPixel(b, i);
  return out;
}
/** Pack a 1600-entry 0/1 array back to a packed 200-byte bitmap. */
function pack(arr: Uint8Array): Uint8Array {
  const out = emptyBitmap();
  for (let i = 0; i < PIXELS; i++) setBit(out, i, (arr[i] ? 1 : 0) as 0 | 1);
  return out;
}

export function PixelEditor({
  original,
  initial,
  apLimit,
  onChange,
}: {
  original: Uint8Array;
  initial: Uint8Array;
  apLimit: number;
  onChange: (b: Uint8Array) => void;
}) {
  const initialArr = useMemo(() => unpack(initial), [initial]);
  const originalArr = useMemo(() => unpack(original), [original]);

  const [pixels, setPixels] = useState<Uint8Array>(() => Uint8Array.from(initialArr));
  const [tool, setTool] = useState<Tool>("draw");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<Set<number> | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<Active>(null);
  const lastGridRef = useRef<{ gx: number; gy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  // Latest state for event handlers, without stale closures.
  const S = useRef<Snapshot>({ pixels, tool, zoom, pan, preview, overlay });
  S.current = { pixels, tool, zoom, pan, preview, overlay };

  // Notify parent (packed bitmap) on every change.
  useEffect(() => {
    onChange(pack(pixels));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels]);

  // Action points used = pixels differing from the on-chain original.
  const used = useMemo(() => {
    let n = 0;
    for (let i = 0; i < PIXELS; i++) if (pixels[i] !== originalArr[i]) n++;
    return n;
  }, [pixels, originalArr]);

  const vpWidth = () => containerRef.current?.clientWidth ?? 320;

  const toGrid = (cx: number, cy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cs = (rect.width * S.current.zoom) / SZ;
    const gx = Math.floor((cx - rect.left - S.current.pan.x) / cs);
    const gy = Math.floor((cy - rect.top - S.current.pan.y) / cs);
    return { gx, gy, ok: gx >= 0 && gx < SZ && gy >= 0 && gy < SZ };
  };

  // Bresenham line — continuous swipe painting.
  const lineIndices = (x0: number, y0: number, x1: number, y1: number) => {
    const pts: number[] = [];
    const dx = Math.abs(x1 - x0),
      dy = Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (x0 >= 0 && x0 < SZ && y0 >= 0 && y0 < SZ) pts.push(y0 * SZ + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return pts;
  };

  const circleIndices = (x0: number, y0: number, x1: number, y1: number) => {
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      rx = Math.abs(x1 - x0) / 2,
      ry = Math.abs(y1 - y0) / 2;
    const set = new Set<number>();
    for (let a = 0; a < 360; a += 0.5) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + rx * Math.cos(rad)),
        y = Math.round(cy + ry * Math.sin(rad));
      if (x >= 0 && x < SZ && y >= 0 && y < SZ) set.add(y * SZ + x);
    }
    return set;
  };

  const squareIndices = (x0: number, y0: number, x1: number, y1: number) => {
    const set = new Set<number>();
    const lx = Math.max(0, Math.min(x0, x1)),
      rx = Math.min(SZ - 1, Math.max(x0, x1)),
      ty = Math.max(0, Math.min(y0, y1)),
      by = Math.min(SZ - 1, Math.max(y0, y1));
    for (let x = lx; x <= rx; x++) {
      set.add(ty * SZ + x);
      set.add(by * SZ + x);
    }
    for (let y = ty; y <= by; y++) {
      set.add(y * SZ + lx);
      set.add(y * SZ + rx);
    }
    return set;
  };

  const clampPan = (x: number, y: number, z: number) => {
    const vp = vpWidth(),
      ws = vp * z;
    return {
      x: ws <= vp ? 0 : Math.min(0, Math.max(vp - ws, x)),
      y: ws <= vp ? 0 : Math.min(0, Math.max(vp - ws, y)),
    };
  };

  // Render the canvas after every state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { pixels: px, preview: pv, overlay: ov } = S.current;
    ctx.clearRect(0, 0, SZ, SZ);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, SZ, SZ);
    ctx.fillStyle = INK;
    for (let i = 0; i < PIXELS; i++) if (px[i]) ctx.fillRect(i % SZ, Math.floor(i / SZ), 1, 1);
    if (pv) {
      ctx.fillStyle = "rgba(72,73,75,0.5)";
      pv.forEach((i) => ctx.fillRect(i % SZ, Math.floor(i / SZ), 1, 1));
    }
    if (ov?.img) {
      ctx.save();
      ctx.globalAlpha = ov.opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(ov.img, ov.x, ov.y, SZ * ov.scale, SZ * ov.scale);
      ctx.restore();
    }
  });

  // AP cost map: the pixels that differ from the original (= the AP being spent).
  useEffect(() => {
    const canvas = diffCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, SZ, SZ);
    ctx.fillStyle = INK;
    for (let i = 0; i < PIXELS; i++)
      if (pixels[i] !== originalArr[i]) ctx.fillRect(i % SZ, Math.floor(i / SZ), 1, 1);
  }, [pixels, originalArr]);

  const getXY = (e: Ptr) =>
    "touches" in e && e.touches.length
      ? { cx: e.touches[0].clientX, cy: e.touches[0].clientY }
      : { cx: (e as React.MouseEvent).clientX, cy: (e as React.MouseEvent).clientY };

  const paintPixels = (indices: number[] | Set<number>, erase: boolean) => {
    setPixels((prev) => {
      const n = Uint8Array.from(prev);
      indices.forEach((i) => {
        n[i] = erase ? 0 : 1;
      });
      return n;
    });
  };

  const onDown = (e: Ptr) => {
    if (e.cancelable) e.preventDefault();
    const { cx, cy } = getXY(e);

    if ("touches" in e && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX,
        dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom: S.current.zoom };
      activeRef.current = { type: "pinch" };
      return;
    }

    const { gx, gy, ok } = toGrid(cx, cy);

    if (S.current.overlay && !S.current.overlay.locked) {
      activeRef.current = {
        type: "overlay",
        sx: gx,
        sy: gy,
        ox: S.current.overlay.x,
        oy: S.current.overlay.y,
      };
      return;
    }

    const t = S.current.tool;
    if (t === "draw" || t === "erase") {
      // Draw toggles by direction of the first touched pixel: tap a white pixel
      // → paint black, tap a black pixel → clear to white; a swipe stays
      // consistent with that first pixel. Erase tool (or right-click) always clears.
      let erase: boolean;
      if (t === "erase" || ("button" in e && e.button === 2)) {
        erase = true;
      } else {
        erase = ok ? S.current.pixels[gy * SZ + gx] === 1 : false;
      }
      activeRef.current = { type: "paint", erase };
      lastGridRef.current = { gx, gy };
      if (ok) paintPixels([gy * SZ + gx], erase);
    } else if ((t === "circle" || t === "square") && ok) {
      activeRef.current = { type: "shape", kind: t, sx: gx, sy: gy };
      setPreview(new Set());
    }
  };

  const onMove = (e: Ptr) => {
    const act = activeRef.current;
    if (!act) return;
    if (e.cancelable) e.preventDefault();
    const { cx, cy } = getXY(e);

    if (act.type === "pinch" && "touches" in e && e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX,
        dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newZ = Math.max(1, Math.min(8, (pinchRef.current.zoom * dist) / pinchRef.current.dist));
      setZoom(newZ);
      setPan((p) => clampPan(p.x, p.y, newZ));
      return;
    }

    const { gx, gy, ok } = toGrid(cx, cy);

    if (act.type === "paint" && ok) {
      const last = lastGridRef.current || { gx, gy };
      paintPixels(lineIndices(last.gx, last.gy, gx, gy), act.erase);
      lastGridRef.current = { gx, gy };
    }

    if (act.type === "shape") {
      setPreview(
        act.kind === "circle"
          ? circleIndices(act.sx, act.sy, gx, gy)
          : squareIndices(act.sx, act.sy, gx, gy)
      );
    }

    if (act.type === "overlay") {
      const dx = gx - act.sx,
        dy = gy - act.sy;
      setOverlay((prev) => (prev ? { ...prev, x: act.ox + dx, y: act.oy + dy } : prev));
    }
  };

  const onUp = () => {
    const act = activeRef.current;
    if (!act) return;
    if (act.type === "shape" && S.current.preview?.size) {
      paintPixels([...S.current.preview], false);
      setPreview(null);
    }
    activeRef.current = null;
    pinchRef.current = null;
    lastGridRef.current = null;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setOverlay({ img, x: 0, y: 0, scale: 1, opacity: 0.5, locked: true });
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const applyOverlay = (mode: "merge" | "replace") => {
    const ov = S.current.overlay;
    if (!ov?.img) return;
    const off = document.createElement("canvas");
    off.width = SZ;
    off.height = SZ;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ov.img, ov.x, ov.y, SZ * ov.scale, SZ * ov.scale);
    const d = ctx.getImageData(0, 0, SZ, SZ).data;
    setPixels((prev) => {
      const n = mode === "replace" ? new Uint8Array(PIXELS) : Uint8Array.from(prev);
      for (let i = 0; i < PIXELS; i++)
        if (d[i * 4 + 3] > 10 && (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3 < 128) n[i] = 1;
      return n;
    });
  };

  const tools: { id: Tool; label: string }[] = [
    { id: "draw", label: "✏ Draw" },
    { id: "erase", label: "◻ Erase" },
    { id: "circle", label: "○ Circle" },
    { id: "square", label: "□ Square" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ApBudgetMeter used={used} total={apLimit} />

      {/* Tools */}
      <div className="flex flex-wrap gap-2">
        {tools.map((tl) => (
          <button
            key={tl.id}
            className={`nm-btn !px-3 !py-1.5 ${tool === tl.id ? "nm-btn-accent" : ""}`}
            style={{ touchAction: "manipulation" }}
            onClick={() => setTool(tl.id)}
          >
            {tl.label}
          </button>
        ))}
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => fileInputRef.current?.click()}
        >
          ⬆ Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Zoom + canvas ops */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => {
            const z = Math.min(8, zoom + 0.5);
            setZoom(z);
            setPan((p) => clampPan(p.x, p.y, z));
          }}
        >
          ＋
        </button>
        <span className="nm-label min-w-[3rem] text-center">
          {zoom === 1 ? "1×" : `${zoom.toFixed(1)}×`}
        </span>
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => {
            const z = Math.max(1, zoom - 0.5);
            setZoom(z);
            setPan(clampPan(0, 0, z));
          }}
        >
          －
        </button>
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset view
        </button>
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => setPixels(Uint8Array.from(initialArr))}
          title="Back to the current on-chain image"
        >
          Revert
        </button>
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => setPixels(Uint8Array.from(originalArr))}
          title="Reset to the original mint image — frees all AP to start fresh"
        >
          To original
        </button>
        <button
          className="nm-btn !px-3 !py-1.5"
          style={{ touchAction: "manipulation" }}
          onClick={() => setPixels(new Uint8Array(PIXELS))}
        >
          Clear
        </button>
      </div>

      {/* Canvas viewport — responsive square */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[420px] select-none self-center overflow-hidden border border-border-strong"
        style={{
          aspectRatio: "1 / 1",
          touchAction: "none",
          cursor: tool === "draw" ? "crosshair" : tool === "erase" ? "cell" : "default",
        }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="absolute"
          style={{ left: pan.x, top: pan.y, width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
        >
          <canvas
            ref={canvasRef}
            width={SZ}
            height={SZ}
            style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }}
          />
        </div>
      </div>

      {/* AP cost map — which pixels differ from the original (= the AP being spent) */}
      <div className="flex w-full max-w-[420px] items-center gap-3 self-center border border-border p-3">
        <canvas
          ref={diffCanvasRef}
          width={SZ}
          height={SZ}
          className="border border-border-strong"
          style={{ width: 64, height: 64, imageRendering: "pixelated", flexShrink: 0 }}
        />
        <div className="text-xs text-muted">
          <span className="nm-label">AP cost map</span>
          <p className="mt-1 leading-relaxed">
            Dark dots = pixels changed from the original; each one costs 1 AP. Erase a
            dot (or hit “To original”) to win that AP back.
          </p>
        </div>
      </div>

      {/* Image overlay controls */}
      {overlay && (
        <div className="flex flex-col gap-2 self-center w-full max-w-[420px] border border-border p-3">
          <span className="nm-label">Image overlay</span>
          <label className="flex items-center gap-2">
            <span className="nm-label min-w-[3.5rem]">Opacity</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={overlay.opacity}
              onChange={(e) =>
                setOverlay((v) => (v ? { ...v, opacity: parseFloat(e.target.value) } : v))
              }
              className="flex-1"
              style={{ accentColor: "var(--fg)" }}
            />
            <span className="font-mono text-xs min-w-[2.5rem] text-right">
              {Math.round(overlay.opacity * 100)}%
            </span>
          </label>
          <label className="flex items-center gap-2">
            <span className="nm-label min-w-[3.5rem]">Scale</span>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.1}
              value={overlay.scale}
              onChange={(e) =>
                setOverlay((v) => (v ? { ...v, scale: parseFloat(e.target.value) } : v))
              }
              className="flex-1"
              style={{ accentColor: "var(--fg)" }}
            />
            <span className="font-mono text-xs min-w-[2.5rem] text-right">
              {overlay.scale.toFixed(1)}×
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={`nm-btn !px-3 !py-1 ${!overlay.locked ? "nm-btn-accent" : ""}`}
              onClick={() => setOverlay((v) => (v ? { ...v, locked: !v.locked } : v))}
            >
              {overlay.locked ? "🔒 Locked" : "↔ Move"}
            </button>
            <button className="nm-btn !px-3 !py-1" onClick={() => applyOverlay("merge")}>
              Apply (merge)
            </button>
            <button className="nm-btn !px-3 !py-1" onClick={() => applyOverlay("replace")}>
              Apply (replace)
            </button>
            <button className="nm-btn !px-3 !py-1" onClick={() => setOverlay(null)}>
              ✕ Remove
            </button>
          </div>
        </div>
      )}

      <p className="nm-label text-center leading-relaxed">
        Draw: tap a white pixel to fill it, tap a black pixel to clear it &middot; swipe
        to paint &middot; pinch to zoom
      </p>
    </div>
  );
}
