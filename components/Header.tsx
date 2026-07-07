"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/scalp", label: "Scalp" },
  { href: "/ledger", label: "Ledger" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800/60 bg-[#030307]/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-6 w-6 rounded bg-blue-500/20 border border-blue-500/50" />
          <span className="font-semibold tracking-tight text-sm sm:text-base">
            GAKE
            <span className="hidden sm:inline text-zinc-500 font-normal">
              {" "}
              // Get Alpha, Knock &apos;Em
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 mx-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-md transition-colors ${
                  active
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-[11px] text-zinc-600 font-mono shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden sm:inline">LIVE</span>
        </div>
      </div>
    </header>
  );
}
