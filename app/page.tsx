import { supabase } from "@/lib/supabase";
import SignalCard, { type Signal } from "@/components/SignalCard";
import ExpandableSection from "@/components/ExpandableSection";
import SharpMoneySidebar from "@/components/SharpMoneySidebar";

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

interface UncoveredRow {
  city_name: string;
  target_date: string;
  predicted_temp: number | null;
}

interface ActivityRow {
  id: string;
  wallet_label: string;
  side: string;
  entry_price: number;
  size_usd: number;
  tx_time: string;
  markets: { city_name: string; target_date: string } | null;
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
  const uncoveredKeys = Array.from(allKeys.values()).filter(
    (m) => !coveredKeys.has(`${m.city_name}|${m.target_date}`)
  );

  const { data: forecastsRaw } = await supabase
    .from("weather_forecasts")
    .select("city_name, target_date, predicted_temp");

  const forecastByKey = new Map<string, number>();
  for (const f of forecastsRaw || []) {
    forecastByKey.set(`${f.city_name}|${f.target_date}`, f.predicted_temp);
  }

  const uncovered: UncoveredRow[] = uncoveredKeys.map((m) => ({
    ...m,
    predicted_temp: forecastByKey.get(`${m.city_name}|${m.target_date}`) ?? null,
  }));

  const { data: activityRaw } = await supabase
    .from("wallet_activity")
    .select("id, wallet_label, side, entry_price, size_usd, tx_time, markets(city_name, target_date)")
    .order("tx_time", { ascending: false })
    .limit(30);

  const activity = (activityRaw || []) as unknown as ActivityRow[];

  return { signals, uncovered, activity };
}

export default async function Home() {
  const { signals, uncovered, activity } = await getData();
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-10 py-8 flex flex-col lg:flex-row gap-7">
      <div className="flex-1 min-w-0">
        <div className="mb-6 text-[13px] text-[color:var(--text-dim)]">
          <b className="text-[color:var(--foreground)] font-bold">{signals.length}</b> signals live
          &nbsp;·&nbsp;
          <b className="text-[color:var(--foreground)] font-bold">{uncovered.length}</b> other open markets
        </div>

        <ExpandableSection
          title="Gap Radar"
          totalCount={signals.length}
          emptyText="No signals yet. Waiting for next calculation cycle."
        >
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} market={s.markets} />
          ))}
        </ExpandableSection>

        <ExpandableSection title="Live Weather Feed — Other Open Markets" totalCount={uncovered.length}>
          {uncovered.map((m) => (
            <div
              key={`${m.city_name}|${m.target_date}`}
              className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--panel)] px-5 py-4.5"
            >
              <div className="text-base font-bold truncate">{m.city_name}</div>
              <div className="font-mono text-[11px] text-[color:var(--text-faint)] mt-1 mb-3">
                {m.target_date}
              </div>
              {m.predicted_temp !== null ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-semibold text-[color:var(--foreground)]">
                    {m.predicted_temp.toFixed(1)}°C
                  </span>
                  <span className="text-[10px] font-semibold text-[color:var(--text-dim)] bg-[rgba(144,137,184,0.1)] rounded-full px-2.5 py-1">
                    NO PACKAGE
                  </span>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-[color:var(--text-dim)] bg-[rgba(144,137,184,0.1)] rounded-full px-3 py-1.5 inline-block">
                  FETCHING...
                </div>
              )}
            </div>
          ))}
        </ExpandableSection>
      </div>

      <SharpMoneySidebar activity={activity} />
    </div>
  );
}
