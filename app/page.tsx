import { supabase } from "@/lib/supabase";
import SignalCard, { type Signal } from "@/components/SignalCard";
import HeroSignalCard from "@/components/HeroSignalCard";
import ExpandableSection from "@/components/ExpandableSection";
import SharpMoneySidebar from "@/components/SharpMoneySidebar";
import StatsBanner from "@/components/StatsBanner";
import Link from "next/link";

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

interface ResolvedRow {
  net_pnl_pct: number;
  result_status: string;
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
  // Filter out signals whose underlying market has already effectively decided
  // (price converged to ~0 or ~1 before Polymarket flips its `closed` flag) — these
  // are no longer actionable and would otherwise show a misleading Net Gap.
  const actionableSignals = Array.from(latestByMarket.values()).filter(
    (s) => s.markets.current_yes_price < 0.98 && s.markets.current_yes_price > 0.02
  );
  const signals = actionableSignals.sort((a, b) => b.net_gap - a.net_gap);

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

  const { data: resolvedRaw } = await supabase
    .from("resolved_signals")
    .select("net_pnl_pct, result_status");

  const resolved = (resolvedRaw || []) as ResolvedRow[];

  return { signals, uncovered, activity, resolved };
}

export default async function Home() {
  const { signals, uncovered, activity, resolved } = await getData();

  const totalResolved = resolved.length;
  const successCount = resolved.filter((r) => r.result_status === "SUCCESS").length;
  const winRatePct = totalResolved > 0 ? ((successCount / totalResolved) * 100).toFixed(1) : "—";
  const avgRoi =
    totalResolved > 0
      ? (resolved.reduce((sum, r) => sum + r.net_pnl_pct, 0) / totalResolved).toFixed(1)
      : "—";

  const topSignal = signals[0];
  const restSignals = signals.slice(1);

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-10 py-8 flex flex-col lg:flex-row gap-7">
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-[color:var(--text-dim)] leading-relaxed mb-6 max-w-2xl">
          GAKE scans every open weather market on Polymarket and surfaces mispricing —
          both hedged strategy packages and whale timing signals.{" "}
          <Link href="/about" className="text-[color:var(--purple-bright)] font-semibold">
            How it works →
          </Link>
        </p>

        <StatsBanner
          stats={[
            { label: "Signals Live", value: String(signals.length) },
            { label: "Resolved Events", value: String(totalResolved) },
            { label: "Win Rate", value: `${winRatePct}%`, accent: "green" },
            {
              label: "Avg ROI / Event",
              value: totalResolved > 0 ? `${Number(avgRoi) >= 0 ? "+" : ""}${avgRoi}%` : "—",
              accent: Number(avgRoi) >= 0 ? "green" : "red",
            },
          ]}
        />

        {topSignal && <HeroSignalCard signal={topSignal} market={topSignal.markets} />}

        {restSignals.length > 0 && (
          <ExpandableSection
            title="Gap Radar"
            totalCount={restSignals.length}
          >
            {restSignals.map((s) => (
              <SignalCard key={s.id} signal={s} market={s.markets} />
            ))}
          </ExpandableSection>
        )}

        {signals.length === 0 && (
          <p className="text-[color:var(--text-dim)] text-sm mb-9">
            No signals yet. Waiting for next calculation cycle.
          </p>
        )}

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
