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
  GAP_FOUND: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  FAIR_PRICED: "text-zinc-400 border-zinc-600/40 bg-zinc-700/10",
  NEUTRAL: "text-zinc-500 border-zinc-700/40 bg-zinc-800/10",
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
      className="text-[10px] font-mono px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
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
  const badgeStyle = STATUS_STYLE[signal.signal_status] || STATUS_STYLE.NEUTRAL;
  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className="cursor-pointer rounded-xl border border-zinc-800/60 bg-zinc-950/40 backdrop-blur-sm p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{market.city_name}</div>
          <div className="text-xs text-zinc-500">{market.target_date}</div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 font-mono ${badgeStyle}`}
        >
          {signal.signal_status.replace("_", " ")}
          {signal.net_gap > 0 ? ` (+${signal.net_gap}%)` : ` (${signal.net_gap}%)`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-y border-zinc-800/60 py-2">
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Poly Odds</div>
          <div className="font-mono text-sm">
            {(market.current_yes_price * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Net Gap</div>
          <div className="font-mono text-sm text-emerald-400">
            {signal.net_gap > 0 ? "+" : ""}
            {signal.net_gap}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Positions</div>
          <div className="font-mono text-sm">
            {signal.strategy_package.positions.length}
          </div>
        </div>
      </div>

      {!expanded && (
        <p className="text-[11px] text-zinc-600">
          Strategy: Multi-Layer Hedging (NO Bias) · click to expand
        </p>
      )}

      {expanded && (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] text-zinc-500 mb-1">
            Suggested budget split — copy Contract ID and place manually on Polymarket.
          </p>
          {signal.strategy_package.positions.map((p, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 bg-zinc-900/50 rounded px-3 py-2 border border-zinc-800/60"
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-mono font-semibold ${
                    p.side === "YES" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {p.side}
                </span>
                <span className="font-mono text-zinc-300">
                  {p.allocation_pct}% @ {p.entry_price.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 truncate">{p.question}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[140px]">
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
            className="text-[11px] text-zinc-600 mt-1 self-center hover:text-zinc-400"
          >
            Collapse ↑
          </button>
        </div>
      )}
    </div>
  );
}
