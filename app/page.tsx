"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NormiePreview } from "@/components/NormiePreview";
import { fromB64 } from "@/lib/serialize";

type Board = {
  id: string;
  tokenId: string;
  apLimit: number;
  draftCount: number;
  current: Uint8Array;
};

type Sort = "ap" | "drafts" | "new";

const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "Newest" },
  { key: "ap", label: "Most pixels" },
  { key: "drafts", label: "Most drafts" },
];

export default function Explore() {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [sort, setSort] = useState<Sort>("new");

  useEffect(() => {
    let cancelled = false;
    setBoards(null);
    (async () => {
      const res = await fetch(`/api/sessions?sort=${sort}`);
      if (!res.ok) {
        if (!cancelled) setBoards([]);
        return;
      }
      const list = (await res.json()) as {
        id: string;
        tokenId: string;
        apLimit: number;
        draftCount: number;
        current: string;
      }[];
      if (cancelled) return;
      setBoards(
        list.map((b) => ({
          id: b.id,
          tokenId: b.tokenId,
          apLimit: b.apLimit,
          draftCount: b.draftCount,
          current: fromB64(b.current),
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [sort]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <section className="mb-8">
        <h1 className="text-4xl sm:text-5xl">
          Paint the <span className="text-accent">Normies</span>.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Owners open their Normies for the community. Pick any board below,
          paint within its pixel budget, and submit your design. For artists
          nothing to sign — just get creative and have fun.
        </p>
        <Link href="/dashboard" className="nm-btn mt-4 inline-flex no-underline">
          Open your own Normie →
        </Link>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <span className="nm-label">
          {boards ? `${boards.length} open` : "Loading…"}
        </span>
        <div className="flex items-center gap-2">
          <span className="nm-label">Sort</span>
          <div className="flex">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`nm-btn !px-3 !py-1.5 ${
                  sort === s.key ? "!border-accent !text-accent" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {boards === null ? (
        <p className="py-16 text-center text-muted">Loading boards…</p>
      ) : boards.length === 0 ? (
        <div className="nm-card p-10 text-center">
          <p className="text-sm text-muted">
            No open Normies yet.{" "}
            <Link href="/dashboard">Be the first to open one →</Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/s/${b.id}`}
              className="nm-card group flex flex-col gap-2 p-2 no-underline transition-colors hover:!border-accent"
            >
              <div className="border border-border-strong">
                <NormiePreview bitmap={b.current} />
              </div>
              <div className="flex items-baseline justify-between px-1">
                <span className="font-display text-lg text-fg group-hover:text-accent">
                  #{b.tokenId}
                </span>
                <span className="nm-chip">{b.draftCount} drafts</span>
              </div>
              <div className="px-1 pb-1 font-mono text-xs text-muted">
                {b.apLimit} editable px
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
