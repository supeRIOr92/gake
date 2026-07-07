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
  FRESH: "text-[color:var(--green)] bg-[rgba(126,232,184,0.12)]",
  AGING: "text-[#f2c879] bg-[rgba(242,200,121,0.12)]",
  STALE: "text-[color:var(--text-faint)] bg-[rgba(144,137,184,0.1)]",
};

export default function ScalpSignalCard({ signal }: { signal: ScalpSignal }) {
  const currentPrice =
    signal.side === "YES"
      ? signal.markets.current_yes_price
      : signal.markets.current_no_price;
  const priceMove = currentPrice - signal.entry_price;
  const priceMovePct = (priceMove / signal.entry_price) * 100;

  return (
    <div className="rounded-[20px] border border-[color:var(--border)] bg-gradient-to-b from-[color:var(--panel-2)] to-[color:var(--panel)] p-5 flex flex-col gap-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight">{signal.markets.city_name}</div>
          <div className="font-mono text-[11px] text-[color:var(--text-faint)] mt-1">
            {signal.markets.target_date}
          </div>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${AGE_STYLE[signal.age_status]}`}
        >
          {signal.age_status} · {signal.market_age_hours.toFixed(0)}h old
        </span>
      </div>

      <p className="text-[11px] text-[color:var(--text-dim)] truncate">
        {signal.markets.question}
      </p>

      <div className="grid grid-cols-3 gap-2 text-center bg-black/20 rounded-2xl py-3 px-2">
        <div>
          <div className="text-[10px] text-[color:var(--text-faint)] font-semibold uppercase mb-1">
            Whale Entry
          </div>
          <div className="font-mono text-sm">
            <span
              className={
                signal.side === "YES"
                  ? "text-[color:var(--green)]"
                  : "text-[color:var(--red)]"
              }
            >
              {signal.side}
            </span>{" "}
            @ {signal.entry_price.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--text-faint)] font-semibold uppercase mb-1">
            Current
          </div>
          <div className="font-mono text-sm">{currentPrice.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--text-faint)] font-semibold uppercase mb-1">
            Move
          </div>
          <div
            className={`font-mono text-sm ${
              priceMove >= 0 ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
            }`}
          >
            {priceMove >= 0 ? "+" : ""}
            {priceMovePct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[color:var(--text-faint)] border-t border-[color:var(--border)] pt-3">
        <span>
          {signal.wallet_label} entered ${signal.size_usd.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
