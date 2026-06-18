"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { NormiePreview } from "@/components/NormiePreview";
import { fromB64 } from "@/lib/serialize";

type Owned = {
  tokenId: string;
  apLimit: number;
  current: string | null;
  openSessionId: string | null;
  draftCount: number;
};

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [items, setItems] = useState<Owned[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; shown: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setError(null);
    setItems(null);
    try {
      const res = await fetch(`/api/owned?address=${address}`);
      if (!res.ok) {
        setError("Could not load your Normies.");
        setItems([]);
        return;
      }
      const data = (await res.json()) as {
        total: number;
        shown: number;
        items: Owned[];
      };
      setItems(data.items);
      setMeta({ total: data.total, shown: data.shown });
    } catch {
      setError("Network error.");
      setItems([]);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) load();
    else setItems(null);
  }, [isConnected, load]);

  async function open(tokenId: string) {
    setBusyToken(tokenId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerAddress: address, tokenId }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setError(b.error ?? "Failed to open board.");
        return;
      }
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyToken(null);
    }
  }

  async function close(tokenId: string, sessionId: string) {
    setBusyToken(tokenId);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerAddress: address }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setError(b.error ?? "Failed to close board.");
        return;
      }
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyToken(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl sm:text-4xl">Your Normies</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Open any Normie you own for the community to paint. It appears on the{" "}
        <Link href="/">public board</Link> instantly — no link to share.
      </p>

      {!isConnected ? (
        <div className="nm-card mt-6 p-8 text-center text-sm text-muted">
          Connect your wallet (top right) to see your Normies.
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-4 border border-danger px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {items === null ? (
            <p className="py-16 text-center text-muted">Loading your Normies…</p>
          ) : items.length === 0 ? (
            <div className="nm-card mt-6 p-8 text-center text-sm text-muted">
              No Normies found for this wallet.
            </div>
          ) : (
            <>
              {meta && meta.total > meta.shown && (
                <p className="mt-4 text-xs text-muted">
                  Showing {meta.shown} of {meta.total}.
                </p>
              )}
              <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                {items.map((it) => {
                  const busy = busyToken === it.tokenId;
                  return (
                    <div key={it.tokenId} className="nm-card flex flex-col gap-2 p-2">
                      <div className="border border-border-strong">
                        {it.current ? (
                          <NormiePreview bitmap={fromB64(it.current)} />
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-xs text-muted">
                            no preview
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between px-1">
                        <span className="font-display text-lg">#{it.tokenId}</span>
                        {it.openSessionId ? (
                          <span className="nm-chip !border-success !text-success">
                            open
                          </span>
                        ) : (
                          <span className="nm-chip">closed</span>
                        )}
                      </div>
                      <div className="px-1 font-mono text-xs text-muted">
                        {it.apLimit} editable px
                        {it.openSessionId ? ` · ${it.draftCount} drafts` : ""}
                      </div>

                      {it.openSessionId ? (
                        <div className="flex flex-col gap-1 px-1 pb-1">
                          <Link
                            href={`/s/${it.openSessionId}/review`}
                            className="nm-btn nm-btn-accent !py-1.5 no-underline"
                          >
                            Review &amp; apply
                          </Link>
                          <div className="flex gap-1">
                            <Link
                              href={`/s/${it.openSessionId}`}
                              className="nm-btn flex-1 !py-1.5 no-underline"
                            >
                              Paint
                            </Link>
                            <button
                              className="nm-btn nm-btn-danger !py-1.5"
                              disabled={busy}
                              onClick={() => close(it.tokenId, it.openSessionId!)}
                            >
                              {busy ? "…" : "Close"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="nm-btn nm-btn-accent mx-1 mb-1 !py-1.5"
                          disabled={busy}
                          onClick={() => open(it.tokenId)}
                        >
                          {busy ? "Opening…" : "Open for editing"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
