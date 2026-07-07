interface ScalpSignal {
  id: string;
  market_id: string;
  wallet_label: string;
  side: string;
  entry_price: number;
  size_usd: number;
  market_age_hours: number;
  age_status: "FRESH" | "AGING" | "STALE";
  detected_at: string;
  markets: {
    city_name: string;
    target_date: string;
    question: string;
    current_yes_price: number;
    current_no_price: number;
  };
}

const AGE_STYLE: Record<string, string> = {
  FRESH: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  AGING: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  STALE: "text-zinc-500 border-zinc-700/40 bg-zinc-800/10",
};

export default function ScalpSignalCard({ signal }: { signal: ScalpSignal }) {
  const currentPrice =
    signal.side === "YES"
      ? signal.markets.current_yes_price
      : signal.markets.current_no_price;
  const priceMove = currentPrice - signal.entry_price;
  const priceMovePct = (priceMove / signal.entry_price) * 100;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 backdrop-blur-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{signal.markets.city_name}</div>
          <div className="text-xs text-zinc-500">{signal.markets.target_date}</div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 font-mono ${AGE_STYLE[signal.age_status]}`}
        >
          {signal.age_status} · {signal.market_age_hours.toFixed(0)}h old
        </span>
      </div>

      <p className="text-[11px] text-zinc-500 truncate">{signal.markets.question}</p>

      <div className="grid grid-cols-3 gap-2 text-center border-y border-zinc-800/60 py-2">
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Whale Entry</div>
          <div className="font-mono text-sm">
            <span
              className={signal.side === "YES" ? "text-emerald-400" : "text-red-400"}
            >
              {signal.side}
            </span>{" "}
            @ {signal.entry_price.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Current Price</div>
          <div className="font-mono text-sm">{currentPrice.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Move</div>
          <div
            className={`font-mono text-sm ${
              priceMove >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {priceMove >= 0 ? "+" : ""}
            {priceMovePct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-600">
        <span>{signal.wallet_label} entered ${signal.size_usd.toLocaleString()}</span>
      </div>
    </div>
  );
}
