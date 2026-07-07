"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/scalp", label: "Scalp" },
  { href: "/ledger", label: "Ledger" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[color:var(--border)] backdrop-blur-md sticky top-0 z-50 bg-[color:var(--background)]/80">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-10 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0" onClick={() => setOpen(false)}>
          <div className="relative w-[34px] h-[34px] shrink-0 rounded-[40%_40%_50%_50%/45%_45%_55%_55%] bg-gradient-to-br from-[#c9c0ff] to-[#6f5fe0] shadow-[0_0_18px_rgba(171,159,242,0.5)]">
            <span className="absolute left-[30%] top-[42%] w-1 h-1 rounded-full bg-[#1a1428]" />
            <span className="absolute right-[30%] top-[42%] w-1 h-1 rounded-full bg-[#1a1428]" />
          </div>
          <div>
            <div className="text-[15px] sm:text-lg font-extrabold tracking-tight">
              <span className="text-[color:var(--purple)]">GAKE</span>
              <span className="hidden sm:inline"> // Get Alpha, Knock &apos;Em</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[color:var(--text-faint)] mt-0.5">
              Weather Arbitrage Signals
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 mx-auto bg-[color:var(--panel)] p-1.5 rounded-xl">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[13px] font-semibold px-4 py-2 rounded-[9px] transition-colors ${
                  active
                    ? "text-[#0e0b1a] bg-gradient-to-br from-[#c9c0ff] to-[#ab9ff2]"
                    : "text-[color:var(--text-dim)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--panel-2)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[color:var(--green)] bg-[rgba(126,232,184,0.1)] px-3.5 py-1.5 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--green)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[color:var(--green)]" />
            </span>
            LIVE
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden flex flex-col justify-center gap-1.5 w-9 h-9 rounded-lg bg-[color:var(--panel)] items-center"
          >
            <span
              className={`block w-4 h-[1.5px] bg-[color:var(--text)] transition-transform ${
                open ? "rotate-45 translate-y-[5px]" : ""
              }`}
            />
            <span
              className={`block w-4 h-[1.5px] bg-[color:var(--text)] transition-opacity ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-4 h-[1.5px] bg-[color:var(--text)] transition-transform ${
                open ? "-rotate-45 -translate-y-[5px]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[color:var(--border)] px-5 py-3 flex flex-col gap-1 bg-[color:var(--background)]">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "text-[#0e0b1a] bg-gradient-to-br from-[#c9c0ff] to-[#ab9ff2]"
                    : "text-[color:var(--text-dim)] bg-[color:var(--panel)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
