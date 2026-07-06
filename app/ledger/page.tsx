import { supabase } from "@/lib/supabase";

export const revalidate = 300;

interface SettledMarket {
  id: string;
  city_name: string;
  target_date: string;
  question: string;
  resolved_temp: number | null;
  resolved_at: string | null;
  current_yes_price: number;
}

async function getSettled() {
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "settled")
    .order("resolved_at", { ascending: false })
    .limit(100);
  return (data || []) as SettledMarket[];
}

export default async function LedgerPage() {
  const settled = await getSettled();

  const successCount = settled.filter((m) => m.current_yes_price >= 0.5).length;
  const total = settled.length;
  const accuracyPct = total > 0 ? ((successCount / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="min-h-screen bg-[#030307] text-zinc-100">
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-500/20 border border-emerald-500/50" />
          <span className="font-semibold tracking-tight">
            GAKE <span className="text-zinc-500 font-normal">// Ledger</span>
          </span>
        </a>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold mb-1">Historical Performance</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Transparent log of settled weather markets GAKE has tracked.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Settled Markets</div>
            <div className="text-2xl font-mono mt-1">{total}</div>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Resolved YES rate</div>
            <div className="text-2xl font-mono mt-1 text-emerald-400">{accuracyPct}%</div>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
            <div className="text-[11px] text-zinc-500 uppercase">Cities Covered</div>
            <div className="text-2xl font-mono mt-1">
              {new Set(settled.map((m) => m.city_name)).size}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">City</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Question</th>
                <th className="text-right px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {settled.map((m) => (
                <tr key={m.id} className="border-t border-zinc-800/60">
                  <td className="px-4 py-2">{m.city_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{m.target_date}</td>
                  <td className="px-4 py-2 text-zinc-400 truncate max-w-xs">
                    {m.question}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                        m.current_yes_price >= 0.5
                          ? "text-emerald-400 border-emerald-500/40"
                          : "text-zinc-500 border-zinc-700/40"
                      }`}
                    >
                      {m.current_yes_price >= 0.5 ? "YES" : "NO"}
                    </span>
                  </td>
                </tr>
              ))}
              {settled.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-600">
                    No settled markets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>        </div>
      </main>
    </div>
  );
}
