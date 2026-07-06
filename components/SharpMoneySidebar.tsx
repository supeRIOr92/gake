interface ActivityRow {
  id: string;
  wallet_label: string;
  side: string;
  entry_price: number;
  size_usd: number;
  tx_time: string;
  markets: {
    city_name: string;
    target_date: string;
  } | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SharpMoneySidebar({ activity }: { activity: ActivityRow[] }) {
  return (
    <aside className="w-full lg:w-72 shrink-0 border border-zinc-800/60 rounded-xl bg-zinc-950/40 p-4 h-fit">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <h3 className="text-sm uppercase tracking-widest text-zinc-500">
          Sharp Money Monitor
        </h3>
      </div>
      <div className="flex flex-col gap-2 font-mono text-[11px] max-h-[520px] overflow-y-auto">
        {activity.length === 0 && (
          <p className="text-zinc-600 text-xs font-sans">
            No large trades detected yet.
          </p>
        )}
        {activity.map((a) => (
          <div
            key={a.id}
            className="border-l-2 border-zinc-800 pl-2 py-1 hover:border-emerald-500/50 transition-colors"
          >
            <div className="flex items-center justify-between text-zinc-500">
              <span>{a.wallet_label}</span>
              <span>{timeAgo(a.tx_time)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={
                  a.side === "YES"
                    ? "text-emerald-400 font-semibold"
                    : a.side === "NO"
                    ? "text-red-400 font-semibold"
                    : "text-zinc-400"
                }
              >
                {a.side}
              </span>
              <span className="text-zinc-300 truncate">
                {a.markets?.city_name ?? "Unknown"}
              </span>
            </div>
            <div className="text-zinc-600">
              @ {a.entry_price.toFixed(3)} · ${a.size_usd.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
