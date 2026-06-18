"use client";
import { NormiePreview } from "./NormiePreview";

export function DraftGallery({
  drafts,
  onSelect,
  selectedId,
}: {
  drafts: {
    id: string;
    nickname: string;
    bitmap: Uint8Array;
    tipAddress?: string | null;
  }[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {drafts.map((d) => {
        const selected = selectedId === d.id;
        return (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`nm-card flex flex-col items-center gap-2 p-2 text-left transition-colors ${
              selected ? "!border-accent" : "hover:!border-fg"
            }`}
          >
            <div className="w-full border border-border-strong">
              <NormiePreview bitmap={d.bitmap} size={130} />
            </div>
            <div className="flex w-full items-center justify-between gap-1">
              <span className="truncate font-mono text-xs text-fg">
                {d.nickname}
              </span>
              {d.tipAddress ? <span className="nm-chip">tip</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
