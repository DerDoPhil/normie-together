"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSendTransaction, useWriteContract } from "wagmi";
import { parseEther, type Address } from "viem";
import { DraftGallery } from "@/components/DraftGallery";
import { NormiePreview } from "@/components/NormiePreview";
import { fromB64 } from "@/lib/serialize";
import { xorOverlay } from "@/lib/bitmap";
import { deviationFromOriginal } from "@/lib/ap";
import { buildApplyTx } from "@/lib/normies/contract";
import { NORMIES_NFT } from "@/lib/normies/addresses";

// Developer of Normie-Together — shown as an optional tip on large edits.
const DEV_TIP_ADDRESS = "0xa9DD0E4119E4716bE4e4A211aE89a442A7e652CC";
const BIG_EDIT_THRESHOLD = 200; // pixels changed vs. original

type Draft = {
  id: string;
  nickname: string;
  bitmap: Uint8Array;
  tipAddress: string | null;
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { address } = useAccount();

  const { writeContract, data: txHash, isPending, error: txError } =
    useWriteContract();
  const {
    sendTransaction,
    data: tipHash,
    isPending: tipPending,
    error: tipError,
  } = useSendTransaction();
  const {
    sendTransaction: sendDev,
    data: devTipHash,
    isPending: devTipPending,
    error: devTipError,
  } = useSendTransaction();

  const [tokenId, setTokenId] = useState<string | null>(null);
  const [original, setOriginal] = useState<Uint8Array | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "closed" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState("0.01");
  const [copied, setCopied] = useState(false);
  const [devTipAmount, setDevTipAmount] = useState("0.005");
  const [devCopied, setDevCopied] = useState(false);
  const [appliedNick, setAppliedNick] = useState<string | null>(null);
  const [autoClosed, setAutoClosed] = useState(false);

  async function load() {
    const sRes = await fetch(`/api/sessions/${id}`);
    if (!sRes.ok) {
      setMsg("Session not found.");
      return;
    }
    const s = (await sRes.json()) as {
      tokenId: string;
      original: string;
      status: "open" | "closed";
    };
    setTokenId(s.tokenId);
    setOriginal(fromB64(s.original));
    setStatus(s.status);

    const dRes = await fetch(`/api/sessions/${id}/drafts`);
    if (dRes.ok) {
      const list = (await dRes.json()) as {
        id: string;
        nickname: string;
        target: string;
        tipAddress: string | null;
      }[];
      setDrafts(
        list.map((d) => ({
          id: d.id,
          nickname: d.nickname,
          bitmap: fromB64(d.target),
          tipAddress: d.tipAddress,
        }))
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selected = drafts.find((d) => d.id === selectedId) ?? null;

  function apply() {
    if (!original || !tokenId || !selected) return;
    setAppliedNick(selected.nickname);
    const overlay = xorOverlay(original, selected.bitmap);
    writeContract(buildApplyTx(BigInt(tokenId), overlay));
  }

  // Applying a draft ends the board: auto-close it so no new drafts come in.
  useEffect(() => {
    if (!txHash || status !== "open" || !address || autoClosed) return;
    setAutoClosed(true);
    fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerAddress: address }),
    })
      .then((res) => {
        if (res.ok) setStatus("closed");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash]);

  function sendTip() {
    if (!selected?.tipAddress) return;
    try {
      sendTransaction({
        to: selected.tipAddress as Address,
        value: parseEther(tipAmount || "0"),
      });
    } catch {
      setMsg("Invalid tip amount.");
    }
  }

  async function copyAddress() {
    if (!selected?.tipAddress) return;
    try {
      await navigator.clipboard.writeText(selected.tipAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Couldn’t copy — please copy the address manually.");
    }
  }

  function sendDevTip() {
    try {
      sendDev({ to: DEV_TIP_ADDRESS as Address, value: parseEther(devTipAmount || "0") });
    } catch {
      setMsg("Invalid tip amount.");
    }
  }

  async function copyDevAddress() {
    try {
      await navigator.clipboard.writeText(DEV_TIP_ADDRESS);
      setDevCopied(true);
      setTimeout(() => setDevCopied(false), 2000);
    } catch {
      setMsg("Couldn’t copy — please copy the address manually.");
    }
  }

  // Pixels this draft changes vs. the original — large edits prompt a dev tip too.
  const pixelsChanged =
    original && selected ? deviationFromOriginal(original, selected.bitmap) : 0;
  const bigEdit = pixelsChanged > BIG_EDIT_THRESHOLD;

  async function closeSession() {
    setMsg(null);
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerAddress: address }),
    });
    if (res.ok) {
      setStatus("closed");
      setMsg("Session closed — the painter link is now read-only.");
    } else {
      const body = (await res.json()) as { error?: string };
      setMsg(body.error ?? "Failed to close session.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl">
          Review drafts
          {tokenId ? (
            <span className="text-accent"> · Normie #{tokenId}</span>
          ) : null}
        </h1>
        {status === "closed" && <span className="nm-chip">closed</span>}
      </div>

      {msg && (
        <p className="mt-4 border border-border px-3 py-2 text-sm text-muted">
          {msg}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Gallery */}
        <section>
          {drafts.length === 0 ? (
            <div className="nm-card p-8 text-center text-sm text-muted">
              No drafts yet. Share the painter link and check back.
            </div>
          ) : (
            <DraftGallery
              drafts={drafts}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}
        </section>

        {/* Selected / actions panel */}
        <aside className="flex flex-col gap-4">
          <div className="nm-card p-4">
            <span className="nm-label">Selected draft</span>
            {selected ? (
              <div className="mt-2">
                <div className="border border-border-strong">
                  <NormiePreview bitmap={selected.bitmap} />
                </div>
                <div className="mt-2 font-mono text-sm">{selected.nickname}</div>

                <button
                  className="nm-btn nm-btn-accent mt-3 w-full"
                  onClick={apply}
                  disabled={isPending || !address || status === "closed"}
                >
                  {isPending ? "Confirm in wallet…" : "Apply on-chain"}
                </button>
                <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
                  Signs <span className="text-fg">setTransformBitmap</span> on the
                  Normies Canvas — only changes your Normie’s image. No token
                  approvals, nothing leaves your wallet, fully reversible. Exactly
                  the same call as editing on normies.art.
                </p>
                {txHash && (
                  <div className="mt-3 border border-fg p-3">
                    <p className="font-display text-sm">
                      ✓ Applied on-chain
                    </p>
                    {autoClosed && appliedNick && (
                      <p className="mt-2 text-xs text-muted">
                        Board closed automatically — you applied{" "}
                        <span className="text-fg">{appliedNick}</span>’s design, so
                        the painter link is now read-only and no new drafts can
                        come in.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      The design is now written to Normie #{tokenId}. To make it
                      show up faster on OpenSea, open the item and press{" "}
                      <a
                        className="text-fg underline"
                        href={`https://opensea.io/assets/ethereum/${NORMIES_NFT}/${tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Refresh metadata
                      </a>
                      .
                    </p>

                    {selected?.tipAddress && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="text-xs text-muted">
                          <span className="text-fg">{selected.nickname}</span>’s
                          address — it’s cool to support artists’ work with a tip:
                        </p>
                        <div className="mt-2 flex items-stretch gap-2">
                          <code className="flex-1 break-all border border-border-strong px-2 py-1 font-mono text-[0.7rem]">
                            {selected.tipAddress}
                          </code>
                          <button
                            className="nm-btn !px-3 !py-1"
                            onClick={copyAddress}
                          >
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-2 text-[0.7rem] text-muted">
                          Send a tip below 👇
                        </p>
                      </div>
                    )}

                    <p className="mt-3 break-all text-[0.65rem] text-muted">
                      tx: {txHash}
                    </p>
                  </div>
                )}
                {txError && (
                  <p className="mt-2 break-all text-xs text-danger">
                    {txError.message}
                  </p>
                )}

                {/* Tipping */}
                <div className="mt-4 border-t border-border pt-4">
                  <span className="nm-label">Tip the artist (optional)</span>
                  {selected.tipAddress ? (
                    <>
                      <p className="mt-1 break-all font-mono text-[0.7rem] text-muted">
                        {selected.tipAddress}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="nm-input"
                          inputMode="decimal"
                          value={tipAmount}
                          onChange={(e) => setTipAmount(e.target.value)}
                          aria-label="Tip amount in ETH"
                        />
                        <span className="self-center text-xs text-muted">
                          ETH
                        </span>
                      </div>
                      <button
                        className="nm-btn mt-2 w-full"
                        onClick={sendTip}
                        disabled={tipPending || !address}
                      >
                        {tipPending ? "Confirm in wallet…" : "Send tip"}
                      </button>
                      {tipHash && (
                        <p className="mt-2 break-all text-xs text-success">
                          ✓ Tip tx: {tipHash}
                        </p>
                      )}
                      {tipError && (
                        <p className="mt-2 break-all text-xs text-danger">
                          {tipError.message}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      This artist didn’t provide a tip address.
                    </p>
                  )}
                </div>

                {/* Developer tip — only on large edits (>200 px changed) */}
                {bigEdit && (
                  <div className="mt-4 border-t border-border pt-4">
                    <span className="nm-label">Tip the developer (optional)</span>
                    <p className="mt-1 text-xs text-muted">
                      Big one — this draft changes {pixelsChanged} pixels. If
                      Normie-Together helped, consider tipping the dev who built it.
                    </p>
                    <div className="mt-2 flex items-stretch gap-2">
                      <code className="flex-1 break-all border border-border-strong px-2 py-1 font-mono text-[0.7rem]">
                        {DEV_TIP_ADDRESS}
                      </code>
                      <button className="nm-btn !px-3 !py-1" onClick={copyDevAddress}>
                        {devCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="nm-input"
                        inputMode="decimal"
                        value={devTipAmount}
                        onChange={(e) => setDevTipAmount(e.target.value)}
                        aria-label="Developer tip amount in ETH"
                      />
                      <span className="self-center text-xs text-muted">ETH</span>
                    </div>
                    <button
                      className="nm-btn mt-2 w-full"
                      onClick={sendDevTip}
                      disabled={devTipPending || !address}
                    >
                      {devTipPending ? "Confirm in wallet…" : "Tip the developer"}
                    </button>
                    {devTipHash && (
                      <p className="mt-2 break-all text-xs text-success">
                        ✓ Tip tx: {devTipHash}
                      </p>
                    )}
                    {devTipError && (
                      <p className="mt-2 break-all text-xs text-danger">
                        {devTipError.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Select a draft to apply it or tip the artist.
              </p>
            )}
          </div>

          <button
            className="nm-btn nm-btn-danger"
            onClick={closeSession}
            disabled={status === "closed" || !address}
          >
            Close session
          </button>
        </aside>
      </div>
    </main>
  );
}
