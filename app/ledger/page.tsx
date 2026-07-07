import { supabase } from "@/lib/supabase";
import RoiChart from "@/components/RoiChart";

export const revalidate = 300;

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

async function getResolved() {
  const { data } = await supabase
    .from("resolved_signals")
    .select("*")
    .order("resolved_at", { ascending: true })
    .limit(500);
  return (data || []) as ResolvedSignal[];
}

export default async function LedgerPage() {
  const resolved = await getResolved();
  const total = resolved.length;
  const successCount = resolved.filter((r) => r.result_status === "SUCCESS").length;
  const defendedCount = resolved.filter((r) => r.result_status === "DEFENDED").length;
  const winRatePct = total > 0 ? ((successCount / total) * 100).toFixed(1) : "0.0";

  const avgRoi =
    total > 0
      ? (resolved.reduce((sum, r) => sum + r.net_pnl_pct, 0) / total).toFixed(1)
      : "0.0";

  let cumulative = 0;
  const chartData = resolved.map((r) => {
    cumulative += r.net_pnl_pct;
    return { date: r.target_date, cumulative: Number(cumulative.toFixed(2)) };
  });

  const displayList = [...resolved].reverse();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

        <h1 className="text-lg font-semibold mb-1">Historical Performance</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Transparent log of settled weather markets GAKE has tracked.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Resolved Events</div>
            <div className="text-2xl font-mono mt-1">{total}</div>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Win Rate</div>
            <div className="text-2xl font-mono mt-1 text-emerald-400">{winRatePct}%</div>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Avg ROI / Event</div>
            <div
              className={`text-2xl font-mono mt-1 ${
                Number(avgRoi) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {Number(avgRoi) >= 0 ? "+" : ""}
              {avgRoi}%
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Defended</div>
            <div className="text-2xl font-mono mt-1 text-amber-400">{defendedCount}</div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 mb-10">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
            Cumulative ROI
          </div>
          <RoiChart data={chartData} />
        </div>
                <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">City</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-right px-4 py-2">Net ROI</th>
                <th className="text-right px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800/60">
                  <td className="px-4 py-2">{r.city_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{r.target_date}</td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      r.net_pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {r.net_pnl_pct >= 0 ? "+" : ""}
                    {r.net_pnl_pct}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                        r.result_status === "SUCCESS"
                          ? "text-emerald-400 border-emerald-500/40"
                          : r.result_status === "DEFENDED"
                          ? "text-amber-400 border-amber-500/40"
                          : "text-red-400 border-red-500/40"
                      }`}
                    >
                      {r.result_status}
                    </span>
                  </td>
                </tr>
              ))}
              {displayList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-600">
                    No resolved events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}

