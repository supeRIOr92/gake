"use client";

import { useState } from "react";
import Modal from "./Modal";
import type { Signal } from "./SignalCard";

interface Position {
  side: "YES" | "NO";
  question: string;
  polymarket_id: string;
  entry_price: number;
  allocation_pct: number;
}

interface Market {
  city_name: string;
  target_date: string;
  question: string;
  current_yes_price: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] font-mono px-2 py-1 rounded-md border border-[color:var(--border)] text-[color:var(--text-dim)] hover:border-[color:var(--purple)] hover:text-[color:var(--purple-bright)] transition-colors"
    >
      {copied ? "Copied!" : "Copy Contract ID"}
    </button>
  );
}

export default function HeroSignalCard({
  signal,
  market,
}: {
  signal: Signal;
  market: Market;
}) {
  const [open, setOpen] = useState(false);
  const gapPositive = signal.net_gap >= 0;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="cursor-pointer relative overflow-hidden rounded-[24px] border border-[rgba(171,159,242,0.35)] bg-gradient-to-br from-[color:var(--panel-2)] via-[color:var(--panel)] to-[#150f24] p-6 sm:p-8 mb-8 hover:border-[color:var(--purple)] transition-colors"
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[color:var(--purple-deep)] opacity-20 blur-[70px] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[color:var(--purple-bright)] bg-[rgba(171,159,242,0.14)] rounded-full px-3 py-1 mb-3">
              Top Opportunity
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              {market.city_name}
            </div>
            <div className="font-mono text-[12px] text-[color:var(--text-faint)] mb-4">
              {market.target_date}
            </div>
            <p className="text-[13px] text-[color:var(--text-dim)] leading-relaxed max-w-md">
              Highest Net Gap live right now — GAKE&apos;s hedging package for this market
              deviates the most from current Polymarket odds.
            </p>
          </div>

          <div className="shrink-0 p-5 sm:p-6 rounded-[20px] bg-black/25 text-center sm:min-w-[200px]">
            <div className="text-[11px] font-semibold text-[color:var(--text-faint)] mb-1.5">
              Net Gap
            </div>
            <div
              className={`font-mono text-[40px] sm:text-[44px] font-bold leading-none ${
                gapPositive ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
              }`}
            >
              {gapPositive ? "+" : ""}
              {signal.net_gap}%
            </div>
            <div className="text-[11px] text-[color:var(--purple-bright)] font-semibold mt-3">
              click to view package →
            </div>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="flex justify-between items-start mb-1">
          <div>
            <div className="text-xl font-extrabold">{market.city_name}</div>
            <div className="font-mono text-[11.5px] text-[color:var(--text-faint)] mt-1">
              {market.target_date}
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

        <div className="my-4.5 p-4 rounded-2xl bg-black/20">
          <div className="text-[11px] font-semibold text-[color:var(--text-faint)] mb-1">
            Net Gap
          </div>
          <div
            className={`font-mono text-[30px] font-semibold leading-none ${
              gapPositive ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
            }`}
          >
            {gapPositive ? "+" : ""}
            {signal.net_gap}%
          </div>
        </div>

        <p className="text-[12.5px] text-[color:var(--text-dim)] leading-relaxed mb-4.5">
          <b className="text-[color:var(--foreground)]">Suggested budget split</b> — copy
          Contract ID and place manually on Polymarket.
        </p>

        <div className="flex flex-col gap-2.5">
          {signal.strategy_package.positions.map((p: Position, i: number) => (
            <div key={i} className="bg-black/[0.16] rounded-[14px] px-4 py-3.5">
              <div className="flex items-baseline justify-between mb-1.5">
                <span
                  className={`text-[13px] font-extrabold ${
                    p.side === "YES" ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
                  }`}
                >
                  {p.side}
                </span>
                <span className="font-mono text-[13.5px] font-semibold text-[color:var(--foreground)]">
                  {p.allocation_pct}% @ {p.entry_price.toFixed(2)}
                </span>
              </div>
              <div className="text-[12.5px] text-[color:var(--text-dim)] leading-snug mb-2.5">
                {p.question}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[color:var(--text-faint)] truncate max-w-[55%]">
                  {p.polymarket_id}
                </span>
                <CopyButton text={p.polymarket_id} />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
