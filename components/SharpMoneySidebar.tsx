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
    <aside className="w-full lg:w-[340px] shrink-0 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 h-fit lg:sticky lg:top-24">
      <div className="flex items-center gap-2.5 pb-4 mb-1 border-b border-[color:var(--border)]">
        <span className="relative flex h-[7px] w-[7px]">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--green)] opacity-75" />
          <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-[color:var(--green)] shadow-[0_0_6px_var(--green)]" />
        </span>
        <h3 className="text-sm font-bold">Sharp Money Monitor</h3>
      </div>
      <div className="flex flex-col font-mono text-[11px] max-h-[520px] overflow-y-auto">
        {activity.length === 0 && (
          <p className="text-[color:var(--text-faint)] text-xs font-sans py-3">
            No large trades detected yet.
          </p>
        )}
        {activity.map((a) => (
          <div
            key={a.id}
            className="py-3.5 border-b border-[color:var(--border)] last:border-b-0"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[color:var(--purple-bright)] font-semibold text-[12px]">
                {a.wallet_label}
              </span>
              <span className="text-[10.5px] text-[color:var(--text-faint)]">
                {timeAgo(a.tx_time)}
              </span>
            </div>
            <div className="text-[13.5px] font-sans font-medium mb-0.5">
              <span
                className={
                  a.side === "YES"
                    ? "text-[color:var(--green)] font-bold"
                    : a.side === "NO"
                    ? "text-[color:var(--red)] font-bold"
                    : "text-[color:var(--text-dim)]"
                }
              >
                {a.side}
              </span>{" "}
              {a.markets?.city_name ?? "Unknown"}
            </div>
            <div className="text-[11.5px] text-[color:var(--text-faint)]">
              @ {a.entry_price.toFixed(3)} · ${a.size_usd.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
