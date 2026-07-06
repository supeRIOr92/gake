import { supabase }
 from "@/lib/supabase";
import SignalCard, { type Signal } from "@/components/SignalCard";

export const revalidate = 60;

interface MarketRow {
  id: string;
  city_name: string;
  target_date: string;
  question: string;
  current_yes_price: number;
  current_no_price: number;
  status: string;
}

interface SignalRow extends Signal {
  markets: MarketRow;
}

async function getData() {
  const { data: signalsRaw } = await supabase
    .from("gake_signals")
    .select("*, markets!inner(*)")
    .eq("markets.status", "active")
    .order("created_at", { ascending: false })
    .limit(500);

  const latestByMarket = new Map<string, SignalRow>();
  for (const s of (signalsRaw || []) as unknown as SignalRow[]) {
    if (!latestByMarket.has(s.market_id)) latestByMarket.set(s.market_id, s);
  }
  const signals = Array.from(latestByMarket.values());

  const { data: allMarkets } = await supabase
    .from("markets")
    .select("city_name, target_date")
    .eq("status", "active");

  const coveredKeys = new Set(
    signals.map((s) => `${s.markets.city_name}|${s.markets.target_date}`)
  );
  const allKeys = new Map<string, { city_name: string; target_date: string }>();
  for (const m of allMarkets || []) {
    allKeys.set(`${m.city_name}|${m.target_date}`, m);
  }
  const uncovered = Array.from(allKeys.values()).filter(
    (m) => !coveredKeys.has(`${m.city_name}|${m.target_date}`)
  );

  return { signals, uncovered };
}

export default async function Home() {
  const { signals, uncovered } = await getData();

  return (
    <div className="min-h-screen bg-[#030307] text-zinc-100">
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-500/20 border border-emerald-500/50" />
          <span className="font-semibold tracking-tight">
            GAKE <span className="text-zinc-500 font-normal">// Alpha Layer v1.0</span>
          </span>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          {signals.length} SIGNALS LIVE · {uncovered.length} UNVERIFIED
        </div>
      </header>

      <main className="px-6 py-8 max-w-7xl mx-auto">
        <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
          Gap Radar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} market={s.markets} />
          ))}
          {signals.length === 0 && (
            <p className="text-zinc-500 text-sm">
              No signals yet. Waiting for next calculation cycle.
            </p>
          )}
        </div>

        <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
          Live Weather Feed — Unverified Stations
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {uncovered.map((m) => (
            <div
              key={`${m.city_name}|${m.target_date}`}
              className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2"
            >
              <div className="text-sm font-medium truncate">{m.city_name}</div>
              <div className="text-xs text-zinc-500">{m.target_date}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-500/80 border border-amber-500/30 rounded px-1.5 py-0.5 inline-block">
                No Signal
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
