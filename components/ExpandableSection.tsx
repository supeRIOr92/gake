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
  const hasMore = totalCount > visibleCount;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[12.5px] font-semibold text-[color:var(--purple-bright)] bg-[color:var(--panel)] border border-[color:var(--border)] rounded-[10px] px-3.5 py-1.5 transition-colors hover:border-[color:var(--purple)]"
          >
            {expanded ? "Show less ↑" : `Show all (${totalCount}) ↓`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown}
        {totalCount === 0 && emptyText && (
          <p className="text-[color:var(--text-dim)] text-sm">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
