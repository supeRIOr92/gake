"use client";

import { useState, type ReactNode } from "react";

export default function ExpandableSection({
  title,
  children,
  totalCount,
  visibleCount = 3,
  emptyText,
}: {
  title: string;
  children: ReactNode[];
  totalCount: number;
  visibleCount?: number;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? children : children.slice(0, visibleCount);
  const hasMore = totalCount > visibleCount;return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm uppercase tracking-widest text-zinc-500">{title}</h2>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-zinc-400 hover:text-emerald-400 border border-zinc-700 rounded px-2 py-1 transition-colors"
          >
            {expanded ? "Show less ↑" : `Show all (${totalCount}) ↓`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown}
        {totalCount === 0 && emptyText && (
          <p className="text-zinc-500 text-sm">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
