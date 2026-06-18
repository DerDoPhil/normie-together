export function ApBudgetMeter({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 100 : Math.min(100, (used / total) * 100);
  const over = used > total;
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="nm-label">Action points</span>
        <span className={`font-mono text-xs ${over ? "font-bold uppercase" : "text-fg"}`}>
          {used} / {total}
          {over ? ` · ${used - total} over` : ""}
        </span>
      </div>
      <div className="h-2 w-full border border-border-strong">
        <div
          className="h-full transition-[width] duration-100"
          style={{
            width: `${pct}%`,
            // Monochrome: solid fill within budget, diagonal hatch when over.
            background: over
              ? "repeating-linear-gradient(45deg, var(--fg) 0 4px, transparent 4px 8px)"
              : "var(--fg)",
          }}
        />
      </div>
    </div>
  );
}
