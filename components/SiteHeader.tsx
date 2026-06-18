"use client";
import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="group no-underline">
            <span className="block font-display text-base leading-none tracking-wide text-fg group-hover:text-accent sm:text-xl">
              NORMIE-<span className="text-accent">TOGETHER</span>
            </span>
            <span className="mt-0.5 block text-[0.6rem] uppercase tracking-[0.18em] text-muted sm:text-[0.65rem]">
              by DoPhil
            </span>
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <Link
              href="/"
              className="text-xs uppercase tracking-[0.12em] text-muted no-underline hover:text-fg"
            >
              Explore
            </Link>
            <Link
              href="/dashboard"
              className="text-xs uppercase tracking-[0.12em] text-muted no-underline hover:text-fg"
            >
              My Normies
            </Link>
            <Link
              href="/how-it-works"
              className="text-xs uppercase tracking-[0.12em] text-muted no-underline hover:text-fg"
            >
              How it works
            </Link>
          </nav>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
