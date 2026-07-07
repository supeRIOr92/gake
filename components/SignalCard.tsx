"use client";

import { useState } from "react";

interface Position {
  side: "YES" | "NO";
  question: string;
  polymarket_id: string;
  entry_price: number;
  allocation_pct: number;
}

export interface Signal {
  id: string;
  market_id: string;
  net_gap: number;
  signal_status: string;
  strategy_package: { positions: Position[] };
  created_at: string;
}

interface Market {
  city_name: string;
  target_date: string;
  question: string;
  current_yes_price: number;
}

const STATUS_STYLE: Record<string, string> = {
  GAP_FOUND: "pos",
  FAIR_PRICED: "neg",
  NEUTRAL: "neu",
};

const PILL_CLASS: Record<string, string> = {
  pos: "text-[color:var(--green)] bg-[rgba(126,232,184,0.12)]",
  neg: "text-[color:var(--red)] bg-[rgba(242,135,159,0.12)]",
  neu: "text-[color:var(--text-dim)] bg-[rgba(144,137,184,0.12)]",
};

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

export default function SignalCard({
  signal,
  market,
}: {
  signal: Signal;
  market: Market;
}) {
  const [expanded, setExpanded] = useState(false);
  const badgeKind = STATUS_STYLE[signal.signal_status] || "neu";
  const gapPositive = signal.net_gap >= 0;

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className="cursor-pointer rounded-[20px] border border-[color:var(--border)] bg-gradient-to-b from-[color:var(--panel-2)] to-[color:var(--panel)] p-5 flex flex-col hover:border-[rgba(171,159,242,0.4)] transition-colors"
    >
      <div className="flex justify-between items-start mb-1">
        <div>
          <div className="text-lg font-bold tracking-tight">{market.city_name}</div>
          <div className="font-mono text-[11px] text-[color:var(--text-faint)] mt-1">
            {market.target_date}
          </div>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${PILL_CLASS[badgeKind]}`}
        >
          {signal.signal_status.replace("_", " ")}
        </span>
      </div>

      <div className="my-4 p-4 rounded-2xl bg-black/20">
        <div className="text-[11px] font-semibold text-[color:var(--text-faint)] mb-1">
          Net Gap
        </div>
        <div
          className={`font-mono text-[28px] font-semibold leading-none ${
            gapPositive ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
          }`}
        >
          {gapPositive ? "+" : ""}
          {signal.net_gap}%
        </div>
      </div>

      <div className="flex gap-6 mb-4">
        <div>
          <div className="text-[10.5px] font-semibold text-[color:var(--text-faint)] mb-0.5">
            Poly Odds
          </div>
          <div className="font-mono text-sm text-[color:var(--foreground)]">
            {(market.current_yes_price * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold text-[color:var(--text-faint)] mb-0.5">
            Positions
          </div>
          <div className="font-mono text-sm text-[color:var(--foreground)]">
            {signal.strategy_package.positions.length}
          </div>
        </div>
      </div>

      {!expanded && (
        <p className="text-xs text-[color:var(--text-dim)] leading-relaxed border-t border-[color:var(--border)] pt-3.5">
          <b className="font-semibold text-[color:var(--text-dim)]">Strategy:</b> Multi-Layer
          Hedging (NO Bias) ·{" "}
          <span className="text-[color:var(--purple-bright)] font-semibold">click to expand</span>
        </p>
      )}

      {expanded && (
        <div
          className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-3.5"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-[color:var(--text-dim)] mb-1">
            Suggested budget split — copy Contract ID and place manually on Polymarket.
          </p>
          {signal.strategy_package.positions.map((p, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 bg-black/20 rounded-xl px-3 py-2.5 border border-[color:var(--border)]"
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-mono font-bold ${
                    p.side === "YES"
                      ? "text-[color:var(--green)]"
                      : "text-[color:var(--red)]"
                  }`}
                >
                  {p.side}
                </span>
                <span className="font-mono text-[color:var(--foreground)]">
                  {p.allocation_pct}% @ {p.entry_price.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-[color:var(--text-dim)] truncate">
                {p.question}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[color:var(--text-faint)] truncate max-w-[140px]">
                  {p.polymarket_id}
                </span>
                <CopyButton text={p.polymarket_id} />
              </div>
            </div>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="text-[11px] text-[color:var(--text-faint)] mt-1 self-center hover:text-[color:var(--text-dim)]"
          >
            Collapse ↑
          </button>
        </div>
      )}
    </div>
  );
}
