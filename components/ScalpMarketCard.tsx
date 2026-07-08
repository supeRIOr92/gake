"use client";

import { useState } from "react";
import Modal from "./Modal";

export interface ScalpEntry {
  walletLabel: string;
  side: string;
  entryPrice: number;
  sizeUsd: number;
  txTime: string;
  movePct: number;
}

export interface ScalpMarket {
  marketId: string;
  cityName: string;
  targetDate: string;
  question: string;
  ageHours: number;
  entries: ScalpEntry[];
  latestEntryTime: string;
  maxMovePct: number;
}

// Real whale backtest (onlylucknobrain, 72 scalped positions): median entry timing was
// 5.9h after market open, 95.8% entered within 24h. Entries this early captured the most
// upside before price corrected — flagging it helps users prioritize where to look first.
const PRIME_ENTRY_HOURS = 8;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function EntryRow({ entry }: { entry: ScalpEntry }) {
  const isPrime = hoursSince(entry.txTime) < PRIME_ENTRY_HOURS;
  return (
    <div className="bg-black/[0.16] rounded-xl px-3.5 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] font-semibold text-[color:var(--purple-bright)]">
          {entry.walletLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {isPrime && (
            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full text-[#0e0b1a] bg-gradient-to-br from-[#c9c0ff] to-[color:var(--green)]">
              PRIME
            </span>
          )}
          <span className="text-[10.5px] font-mono text-[color:var(--text-faint)]">
            {timeAgo(entry.txTime)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">
          <span
            className={
              entry.side === "YES"
                ? "text-[color:var(--green)] font-bold"
                : "text-[color:var(--red)] font-bold"
            }
          >
            {entry.side}
          </span>{" "}
          @ {entry.entryPrice.toFixed(3)} · ${entry.sizeUsd.toLocaleString()}
        </span>
        <span
          className={`font-mono text-[12.5px] font-semibold ${
            entry.movePct >= 0 ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
          }`}
        >
          {entry.movePct >= 0 ? "+" : ""}
          {entry.movePct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function ScalpMarketCard({
  market,
  mode,
}: {
  market: ScalpMarket;
  mode: "fresh" | "aging";
}) {
  const [open, setOpen] = useState(false);
  const entryCount = market.entries.length;
  // Aging: progress toward the ~30-50% historical median exit target
  const targetProgress = Math.max(0, Math.min(100, (market.maxMovePct / 40) * 100));
  const hasPrimeEntry = mode === "fresh" && hoursSince(market.latestEntryTime) < PRIME_ENTRY_HOURS;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-[20px] border border-[color:var(--border)] bg-gradient-to-b from-[color:var(--panel-2)] to-[color:var(--panel)] p-5 flex flex-col hover:border-[rgba(171,159,242,0.4)] hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-lg font-bold tracking-tight">{market.cityName}</div>
            <div className="font-mono text-[11px] text-[color:var(--text-faint)] mt-1">
              {market.targetDate}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasPrimeEntry && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap text-[#0e0b1a] bg-gradient-to-br from-[#c9c0ff] to-[color:var(--green)]">
                PRIME
              </span>
            )}
            {entryCount > 1 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-[color:var(--purple-bright)] bg-[rgba(171,159,242,0.12)]">
                {entryCount} entries
              </span>
            )}
          </div>
        </div>

        {mode === "fresh" ? (
          <div className="my-4 p-4 rounded-2xl bg-black/20">
            <div className="text-[11px] font-semibold text-[color:var(--text-faint)] mb-1">
              Newest Entry
            </div>
            <div className="font-mono text-[24px] font-semibold leading-none text-[color:var(--foreground)]">
              {timeAgo(market.latestEntryTime)}
            </div>
            {hasPrimeEntry && (
              <div className="text-[11px] font-semibold text-[color:var(--green)] mt-2">
                Prime entry window — historically the most profitable scalps started this early
              </div>
            )}
          </div>
        ) : (
          <div className="my-4 p-4 rounded-2xl bg-black/20">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] font-semibold text-[color:var(--text-faint)]">
                Move → Exit Target
              </div>
              <div className="font-mono text-[11px] text-[color:var(--text-faint)]">~30-50%</div>
            </div>
            <div
              className={`font-mono text-[24px] font-semibold leading-none mb-2 ${
                market.maxMovePct >= 0 ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
              }`}
            >
              {market.maxMovePct >= 0 ? "+" : ""}
              {market.maxMovePct.toFixed(1)}%
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#c9c0ff] to-[color:var(--green)]"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold">
              {market.maxMovePct >= 30 ? (
                <span className="text-[color:var(--green)]">✓ In exit range — consider closing</span>
              ) : market.maxMovePct >= 15 ? (
                <span className="text-[#f2c879]">Approaching target · {targetProgress.toFixed(0)}% of the way there</span>
              ) : (
                <span className="text-[color:var(--text-faint)]">{targetProgress.toFixed(0)}% of the way to +30-50% target</span>
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[color:var(--text-dim)] truncate mb-3">{market.question}</p>

        <div className="flex flex-col gap-2">
          {market.entries.slice(0, 2).map((e, i) => (
            <EntryRow key={i} entry={e} />
          ))}
        </div>

        {entryCount > 2 && (
          <p className="text-[11px] text-[color:var(--purple-bright)] font-semibold mt-2.5 text-center">
            +{entryCount - 2} more · click to view all
          </p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="flex justify-between items-start mb-1">
          <div>
            <div className="text-xl font-extrabold">{market.cityName}</div>
            <div className="font-mono text-[11.5px] text-[color:var(--text-faint)] mt-1">
              {market.targetDate}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="w-[30px] h-[30px] shrink-0 rounded-[10px] bg-[color:var(--panel)] border border-[color:var(--border)] text-[color:var(--text-dim)] hover:text-[color:var(--foreground)] hover:border-[color:var(--purple)] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <p className="text-[12.5px] text-[color:var(--text-dim)] leading-relaxed my-4">
          {market.question}
        </p>

        <div className="text-[11px] font-semibold text-[color:var(--text-faint)] uppercase tracking-wide mb-2.5">
          {entryCount} whale {entryCount === 1 ? "entry" : "entries"} detected
        </div>

        <div className="flex flex-col gap-2.5">
          {market.entries.map((e, i) => (
            <EntryRow key={i} entry={e} />
          ))}
        </div>
      </Modal>
    </>
  );
}
