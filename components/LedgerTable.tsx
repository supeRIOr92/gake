"use client";

import { useMemo, useState } from "react";

interface ResolvedSignal {
  id: string;
  market_id: string;
  city_name: string;
  target_date: string;
  question: string;
  net_pnl_pct: number;
  result_status: "SUCCESS" | "DEFENDED" | "LOSS";
  resolved_at: string;
}

type SortKey = "date_desc" | "date_asc" | "roi_desc" | "roi_asc";
type StatusFilter = "ALL" | "SUCCESS" | "DEFENDED" | "LOSS";

const PAGE_SIZE = 25;

export default function LedgerTable({ resolved }: { resolved: ResolvedSignal[] }) {
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const list =
      statusFilter === "ALL"
        ? resolved
        : resolved.filter((r) => r.result_status === statusFilter);

    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "date_desc":
          return b.target_date.localeCompare(a.target_date);
        case "date_asc":
          return a.target_date.localeCompare(b.target_date);
        case "roi_desc":
          return b.net_pnl_pct - a.net_pnl_pct;
        case "roi_asc":
          return a.net_pnl_pct - b.net_pnl_pct;
      }
    });
    return sorted;
  }, [resolved, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function handleSortChange(next: SortKey) {
    setSort(next);
    setPage(1);
  }

  function handleStatusChange(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "SUCCESS", "DEFENDED", "LOSS"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`text-[11px] font-semibold uppercase px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? "border-[color:var(--purple-bright)] text-[color:var(--purple-bright)] bg-[rgba(167,139,250,0.1)]"
                  : "border-[color:var(--border)] text-[color:var(--text-faint)]"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as SortKey)}
          className="text-[11px] font-semibold uppercase bg-[color:var(--panel)] border border-[color:var(--border)] rounded-full px-3 py-1.5 text-[color:var(--text-dim)]"
        >
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="roi_desc">Top ROI</option>
          <option value="roi_asc">Lowest ROI</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/20 text-[color:var(--text-faint)] text-[11px] font-semibold uppercase">
            <tr>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-right px-4 py-3">Net ROI</th>
              <th className="text-right px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--border)]">
                <td className="px-4 py-3 font-medium">{r.city_name}</td>
                <td className="px-4 py-3 text-[color:var(--text-faint)] font-mono text-xs">
                  {r.target_date}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    r.net_pnl_pct >= 0
                      ? "text-[color:var(--green)]"
                      : "text-[color:var(--red)]"
                  }`}
                >
                  {r.net_pnl_pct >= 0 ? "+" : ""}
                  {r.net_pnl_pct}%
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-full ${
                      r.result_status === "SUCCESS"
                        ? "text-[color:var(--green)] bg-[rgba(126,232,184,0.12)]"
                        : r.result_status === "DEFENDED"
                        ? "text-[#f2c879] bg-[rgba(242,200,121,0.12)]"
                        : "text-[color:var(--red)] bg-[rgba(242,135,159,0.12)]"
                    }`}
                  >
                    {r.result_status}
                  </span>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--text-faint)]">
                  gake is sulking, no receipts match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-[color:var(--text-faint)]">
          <span>
            Page {currentPage} of {totalPages} · {filtered.length} events
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-full border border-[color:var(--border)] disabled:opacity-40 font-semibold"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-full border border-[color:var(--border)] disabled:opacity-40 font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
