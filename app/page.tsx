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

interface CurrentWeatherRow {
  city_name: string;
  current_temp_c: number;
  observed_at: string;
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

// Package Win Probability is the primary ranking signal now (replaces sorting
// by raw Best Case ROI). Rationale: ranking by upside alone can surface a
// package that GAKE itself has low confidence in, just because its payout if
// it wins happens to be large — the opposite of what "gake's favorite
// child" should mean. sigma_validated packages (9 cities with real backtest
// history behind FORECAST_ERROR_SIGMA_C) are prioritized over unvalidated
// ones at equal probability, since their confidence number has actually been
// checked against real settlement outcomes.
function rankSignals(signals: SignalRow[]): SignalRow[] {
  return [...signals].sort((a, b) => {
    const aValidated = a.strategy_package.sigma_validated ? 1 : 0;
    const bValidated = b.strategy_package.sigma_validated ? 1 : 0;
    if (aValidated !== bValidated) return bValidated - aValidated;

    const aProb = a.strategy_package.package_win_probability ?? 0;
    const bProb = b.strategy_package.package_win_probability ?? 0;
    return bProb - aProb;
  });
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
  // are no longer actionable and would otherwise show a misleading ROI.
  const actionableSignals = Array.from(latestByMarket.values()).filter(
    (s) => s.markets.current_yes_price < 0.98 && s.markets.current_yes_price > 0.02
  );
  const signals = rankSignals(actionableSignals);

  // Current (observed, real-time) temperature per city — intentionally
  // independent of Polymarket market status, unlike the old "Live Weather
  // Feed" which only ever showed forecasts for city/date combos that
  // happened to have an active market.
  const { data: currentWeatherRaw } = await supabase
    .from("city_current_weather")
    .select("city_name, current_temp_c, observed_at")
    .order("city_name", { ascending: true });

  const currentWeather = (currentWeatherRaw || []) as CurrentWeatherRow[];

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

  return { signals, currentWeather, activity, resolved };
}

export default async function Home() {
  const { signals, currentWeather, activity, resolved } = await getData();

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
        <div className="flex items-start gap-4 mb-6 max-w-2xl">
          <span className="text-5xl leading-none select-none" aria-hidden>
            ☁️<span className="inline-block -ml-4 -mt-2 align-top text-2xl">🕶️</span>
          </span>
          <p className="text-[13.5px] text-[color:var(--text-dim)] leading-relaxed pt-1">
            GAKE watches the sky and bets on it — same forecast data, same
            on-chain whale signals, no feelings involved.{" "}
            <Link href="/about" className="text-[color:var(--purple-bright)] font-semibold">
              how it works →
            </Link>
          </p>
        </div>

        <StatsBanner
          stats={[
            { label: "cities gake is stalking", value: String(signals.length) },
            { label: "gake's receipts", value: String(totalResolved) },
            { label: "gake's hit rate", value: `${winRatePct}%`, accent: "green" },
            {
              label: "gake's average W",
              value: totalResolved > 0 ? `${Number(avgRoi) >= 0 ? "+" : ""}${avgRoi}%` : "—",
              accent: Number(avgRoi) >= 0 ? "green" : "red",
            },
          ]}
        />

        {topSignal && <HeroSignalCard signal={topSignal} market={topSignal.markets} />}

        {restSignals.length > 0 && (
          <ExpandableSection
            title="other things gake is watching"
            totalCount={restSignals.length}
          >
            {restSignals.map((s) => (
              <SignalCard key={s.id} signal={s} market={s.markets} />
            ))}
          </ExpandableSection>
        )}

        {signals.length === 0 && (
          <p className="text-[color:var(--text-dim)] text-sm mb-9">
            gake is thinking really hard rn. check back soon.
          </p>
        )}

        <ExpandableSection title="current conditions" totalCount={currentWeather.length}>
          {currentWeather.map((c) => (
            <div
              key={c.city_name}
              className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--panel)] px-5 py-4.5"
            >
              <div className="text-base font-bold truncate">{c.city_name}</div>
              <div className="font-mono text-[11px] text-[color:var(--text-faint)] mt-1 mb-3">
                observed {new Date(c.observed_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <span className="font-mono text-lg font-semibold text-[color:var(--foreground)]">
                {c.current_temp_c.toFixed(1)}°C
              </span>
            </div>
          ))}
        </ExpandableSection>
      </div>

      <SharpMoneySidebar activity={activity} />
    </div>
  );
}
