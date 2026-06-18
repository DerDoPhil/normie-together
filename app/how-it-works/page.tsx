import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · Normie-Together",
  description:
    "How Normie-Together works: artists paint drafts off-chain for free, the Normie owner applies one on-chain. No delegates, no approvals, fully reversible.",
};

const STEPS = [
  {
    n: "01",
    who: "Owner",
    chain: "on-chain check",
    title: "Open your Normie",
    body: "A Normie owner opens their token as a community board. We read the original mint image, the current image and the token’s Action Points straight from the Normies contracts — nothing is changed on-chain yet.",
  },
  {
    n: "02",
    who: "Artists",
    chain: "off-chain",
    title: "Paint drafts — free, no wallet",
    body: "Anyone can open the painter link and design. Draw, erase, shapes, image overlay, pinch-zoom. Every draft stays within the Action-Point budget. Submitting is a plain form post — no wallet, no gas, no signature, no risk.",
  },
  {
    n: "03",
    who: "Owner",
    chain: "off-chain",
    title: "Review the gallery",
    body: "The owner sees every submitted draft, previews it on their Normie, and picks the one they like best. An optional tip address lets the artist get rewarded.",
  },
  {
    n: "04",
    who: "Owner",
    chain: "on-chain",
    title: "Apply one on-chain",
    body: "The owner signs a single setTransformBitmap call — exactly the same call as editing on normies.art. It only changes their Normie’s image. No approvals, nothing leaves the wallet, fully reversible. The board then closes automatically.",
  },
  {
    n: "05",
    who: "Owner → Artist",
    chain: "optional",
    title: "Tip the artist",
    body: "If the design is great, the owner can reward the artist with a direct ETH tip. You don’t have to pay through the site — you can also just copy the artist’s address and send it from your own wallet. Always optional, always a direct transfer.",
  },
];

// A tiny CSS-pixel illustration: original face → edited face → AP diff.
function MiniGrid({
  cells,
  label,
}: {
  cells: number[]; // 8x8 = 64 entries, 1 = ink
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="grid border border-border-strong"
        style={{
          gridTemplateColumns: "repeat(8, 10px)",
          gridTemplateRows: "repeat(8, 10px)",
        }}
      >
        {cells.map((c, i) => (
          <div key={i} style={{ background: c ? "var(--fg)" : "var(--bg)" }} />
        ))}
      </div>
      <span className="nm-label">{label}</span>
    </div>
  );
}

// 8x8 demo bitmaps
const ORIG = [
  0,0,1,1,1,1,0,0,
  0,1,0,0,0,0,1,0,
  1,0,1,0,0,1,0,1,
  1,0,0,0,0,0,0,1,
  1,0,1,0,0,1,0,1,
  1,0,0,1,1,0,0,1,
  0,1,0,0,0,0,1,0,
  0,0,1,1,1,1,0,0,
];
const EDIT = [
  0,0,1,1,1,1,0,0,
  0,1,0,0,0,0,1,0,
  1,0,1,0,0,1,0,1,
  1,0,0,0,0,0,0,1,
  1,0,1,1,1,1,0,1, // smile changed
  1,0,0,0,0,0,0,1,
  0,1,0,0,0,0,1,0,
  0,0,1,1,1,1,0,0,
];
const DIFF = ORIG.map((c, i) => (c !== EDIT[i] ? 1 : 0));

export default function HowItWorks() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="nm-label">Normies NFT · collaborative canvas</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">How it works</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
        Normie-Together lets a community design a Normie together — without ever
        handing over control. Artists propose, the owner decides and signs. Here’s
        the whole flow.
      </p>

      {/* Flow */}
      <ol className="mt-12 flex flex-col">
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative flex gap-4 sm:gap-6">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-fg font-display text-lg">
                {s.n}
              </div>
              {i < STEPS.length - 1 && (
                <div className="my-1 w-px flex-1 bg-border-strong" />
              )}
            </div>
            {/* Card */}
            <div className="nm-card mb-6 flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl">{s.title}</h2>
                <span className="nm-chip">{s.who}</span>
                <span className="nm-chip">{s.chain}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* AP explainer */}
      <section className="mt-8 nm-card p-6">
        <h2 className="font-display text-2xl">Action Points, simply</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A Normie earns Action Points (AP) by burning other Normies. AP is the
          budget for change: a design may differ from the{" "}
          <span className="text-fg">original mint image</span> by at most that many
          pixels. AP is a fixed ceiling — it is never spent or used up, so a Normie
          can be repainted again and again within the budget.
        </p>

        <div className="mt-6 flex flex-wrap items-end justify-center gap-6 sm:gap-10">
          <MiniGrid cells={ORIG} label="Original" />
          <span className="pb-6 font-display text-2xl text-muted">→</span>
          <MiniGrid cells={EDIT} label="Your design" />
          <span className="pb-6 font-display text-2xl text-muted">=</span>
          <MiniGrid cells={DIFF} label="AP spent" />
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          The cost is always measured against the original — so painting a pixel
          back to how it started{" "}
          <span className="text-fg">gives that AP back</span>. The editor shows a
          live AP cost map of exactly which pixels differ, and a “To original”
          button to start fresh.
        </p>
      </section>

      {/* Safety */}
      <section className="mt-8 nm-card p-6">
        <h2 className="font-display text-2xl">Is it safe for the owner?</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted">
          <li>
            ✓ The owner signs <span className="text-fg">setTransformBitmap</span> on
            the official Normies Canvas — the exact same call as editing on
            normies.art.
          </li>
          <li>✓ It only changes your Normie’s image. No ETH leaves your wallet (just gas).</li>
          <li>✓ No token approvals, no transfers, no delegate is ever set.</li>
          <li>✓ Fully reversible — repaint any time. Your Normie never leaves your wallet.</li>
          <li>
            ✓ Artists never sign anything; drafts live off-chain until you choose
            one.
          </li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          The full source is public so anyone can verify — see the repository
          linked in the footer.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className="nm-btn nm-btn-accent no-underline">
          Explore boards →
        </Link>
        <Link href="/dashboard" className="nm-btn no-underline">
          Open your own Normie
        </Link>
      </div>
    </main>
  );
}
