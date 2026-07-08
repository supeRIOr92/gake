import { supabase } from "@/lib/supabase";
import RoiChart from "@/components/RoiChart";
import LedgerTable from "@/components/LedgerTable";

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

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-1.5">Historical Performance</h1>
      <p className="text-sm text-[color:var(--text-dim)] mb-7">
        Transparent log of settled weather markets GAKE has tracked.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-center">
          <div className="text-[11px] text-[color:var(--text-faint)] font-semibold uppercase">
            Resolved Events
          </div>
          <div className="font-mono text-2xl mt-1.5">{total}</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-center">
          <div className="text-[11px] text-[color:var(--text-faint)] font-semibold uppercase">
            Win Rate
          </div>
          <div className="font-mono text-2xl mt-1.5 text-[color:var(--green)]">
            {winRatePct}%
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-center">
          <div className="text-[11px] text-[color:var(--text-faint)] font-semibold uppercase">
            Avg ROI / Event
          </div>
          <div
            className={`font-mono text-2xl mt-1.5 ${
              Number(avgRoi) >= 0 ? "text-[color:var(--green)]" : "text-[color:var(--red)]"
            }`}
          >
            {Number(avgRoi) >= 0 ? "+" : ""}
            {avgRoi}%
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-center">
          <div className="text-[11px] text-[color:var(--text-faint)] font-semibold uppercase">
            Defended
          </div>
          <div className="font-mono text-2xl mt-1.5 text-[#f2c879]">{defendedCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-5 mb-10">
        <div className="text-xs text-[color:var(--text-faint)] font-semibold uppercase tracking-wide mb-3">
          Cumulative ROI
        </div>
        <RoiChart data={chartData} />
      </div>

      <LedgerTable resolved={resolved} />
    </div>
  );
}
