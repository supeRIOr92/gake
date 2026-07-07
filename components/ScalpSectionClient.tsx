"use client";

import { useState } from "react";
import ScalpMarketCard, { type ScalpMarket } from "./ScalpMarketCard";

const MOVE_FILTERS: { label: string; test: (m: ScalpMarket) => boolean }[] = [
  { label: "All", test: () => true },
  { label: "Move < 1%", test: (m) => m.maxMovePct < 1 },
  { label: "Move 1-5%", test: (m) => m.maxMovePct >= 1 && m.maxMovePct <= 5 },
  { label: "Move > 5%", test: (m) => m.maxMovePct > 5 },
];

export default function ScalpSectionClient({
  title,
  subtitle,
  markets,
  mode,
  emptyText,
}: {
  title: string;
  subtitle: string;
  markets: ScalpMarket[];
  mode: "fresh" | "aging";
  emptyText: string;
}) {
  const [filterIdx, setFilterIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const filtered = markets.filter(MOVE_FILTERS[filterIdx].test);
  const visibleCount = 6;
  const shown = expanded ? filtered : filtered.slice(0, visibleCount);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {filtered.length > visibleCount && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[12.5px] font-semibold text-[color:var(--purple-bright)] bg-[color:var(--panel)] border border-[color:var(--border)] rounded-[10px] px-3.5 py-1.5 hover:border-[color:var(--purple)] transition-colors"
          >
            {expanded ? "Show less ↑" : `Show all (${filtered.length}) ↓`}
          </button>
        )}
      </div>
      <p className="text-[12px] text-[color:var(--text-faint)] mb-4">{subtitle}</p>

      {mode === "aging" && markets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {MOVE_FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilterIdx(i)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filterIdx === i
                  ? "text-[#0e0b1a] bg-gradient-to-br from-[#c9c0ff] to-[#ab9ff2] border-transparent"
                  : "text-[color:var(--text-dim)] bg-[color:var(--panel)] border-[color:var(--border)] hover:text-[color:var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((m) => (
          <ScalpMarketCard key={m.marketId} market={m} mode={mode} />
        ))}
        {filtered.length === 0 && (
          <p className="text-[color:var(--text-dim)] text-sm">
            {markets.length === 0 ? emptyText : "No entries match this filter."}
          </p>
        )}
      </div>
    </section>
  );
}
