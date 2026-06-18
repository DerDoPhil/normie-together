import Link from "next/link";

export function SiteFooter() {
  const linkCls =
    "text-xs uppercase tracking-[0.12em] text-muted no-underline hover:text-fg";
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="nm-label">Normie-Together · by DoPhil</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/how-it-works" className={linkCls}>
            How it works
          </Link>
          <a
            href="https://github.com/DerDoPhil/normie-together"
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            Source / verify ↗
          </a>
          <a
            href="https://www.x.com/xbtphil"
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            X / @xbtphil ↗
          </a>
          <a
            href="https://dophil.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            DoPhil · 2 more Normie tools ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
