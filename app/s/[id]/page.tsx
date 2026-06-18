"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { PixelEditor } from "@/components/PixelEditor";
import { emptyBitmap } from "@/lib/bitmap";
import { deviationFromOriginal } from "@/lib/ap";
import { fromB64, toB64 } from "@/lib/serialize";

type SessionInfo = {
  id: string;
  tokenId: string;
  apLimit: number;
  status: "open" | "closed";
  original: Uint8Array;
  current: Uint8Array;
};

export default function ContributorEditor() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState<Uint8Array>(() => emptyBitmap());
  const [nickname, setNickname] = useState("");
  const [tipAddress, setTipAddress] = useState("");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) {
          if (!cancelled) setLoadError("Session not found.");
          return;
        }
        const data = (await res.json()) as {
          id: string;
          tokenId: string;
          apLimit: number;
          status: "open" | "closed";
          original: string;
          current: string;
        };
        if (cancelled) return;
        const original = fromB64(data.original);
        const current = fromB64(data.current);
        setSession({
          id: data.id,
          tokenId: data.tokenId,
          apLimit: data.apLimit,
          status: data.status,
          original,
          current,
        });
        setTarget(current);
      } catch {
        if (!cancelled) setLoadError("Failed to load session.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const tipInvalid = tipAddress.trim() !== "" && !isAddress(tipAddress.trim());
  const apOver = session
    ? deviationFromOriginal(session.original, target) - session.apLimit
    : 0;
  const overBudget = apOver > 0;

  async function submit() {
    if (!session) return;
    setSubmitMsg(null);
    setSubmitOk(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${id}/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          target: toB64(target),
          tipAddress: tipAddress.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitOk(true);
        setSubmitMsg("Draft submitted! Thanks for painting.");
        return;
      }
      const body = (await res.json()) as { error?: string };
      const map: Record<number, string> = {
        422: "That design exceeds the action-point budget.",
        429: "Too many requests — slow down a moment.",
        409: "This session is closed or full.",
        400: body.error ?? "Invalid submission.",
      };
      setSubmitMsg(map[res.status] ?? body.error ?? "Submission failed.");
    } catch {
      setSubmitMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-2xl">Not found</h1>
        <p className="mt-2 text-sm text-muted">{loadError}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  if (session.status === "closed") {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-2xl">Session closed</h1>
        <p className="mt-2 text-sm text-muted">
          The owner has closed this painting session.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl">
        Paint Normie <span className="text-accent">#{session.tokenId}</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Toggle pixels within the budget, name yourself, and submit. The owner
        picks one design to apply on-chain.
      </p>

      <div className="mt-6">
        <PixelEditor
          original={session.original}
          initial={session.current}
          apLimit={session.apLimit}
          onChange={setTarget}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <label>
          <span className="nm-label">Nickname</span>
          <input
            className="nm-input mt-1"
            placeholder="Your name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        <label>
          <span className="nm-label">
            Tip address (optional) — get tipped if your draft is chosen
          </span>
          <input
            className={`nm-input mt-1 ${tipInvalid ? "!border-danger" : ""}`}
            placeholder="0x… your ETH address"
            value={tipAddress}
            onChange={(e) => setTipAddress(e.target.value)}
          />
          {tipInvalid && (
            <span className="mt-1 block text-xs text-danger">
              Not a valid ETH address.
            </span>
          )}
        </label>

        {overBudget && (
          <p className="border border-fg px-3 py-2 text-xs font-bold uppercase">
            Over budget by {apOver} pixel{apOver === 1 ? "" : "s"} — undo some edits
            to submit.
          </p>
        )}

        <button
          className="nm-btn nm-btn-accent self-start"
          onClick={submit}
          disabled={!nickname.trim() || tipInvalid || busy || overBudget}
        >
          {busy ? "Submitting…" : "Submit draft"}
        </button>

        {submitMsg && (
          <p
            className={`border px-3 py-2 text-sm ${
              submitOk
                ? "border-success text-success"
                : "border-danger text-danger"
            }`}
          >
            {submitMsg}
          </p>
        )}
      </div>
    </main>
  );
}
