import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;

interface Market {
  id: string;
  city_name: string;
  target_date: string;
  polymarket_id: string;
  question: string;
  current_yes_price: number;
  current_no_price: number;
}

interface TempRange {
  min: number;
  max: number;
  unit: 'F' | 'C';
}

function parseTempRange(question: string): TempRange | null {
  const below = question.match(/(-?\d+(?:\.\d+)?)\s*°\s*([FC])\s*or below/i);
  if (below) return { min: -Infinity, max: parseFloat(below[1]), unit: below[2].toUpperCase() as 'F' | 'C' };

  const above = question.match(/(-?\d+(?:\.\d+)?)\s*°\s*([FC])\s*or above/i);
  if (above) return { min: parseFloat(above[1]), max: Infinity, unit: above[2].toUpperCase() as 'F' | 'C' };

  const between = question.match(/between\s*(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\s*°\s*([FC])/i);
  if (between) return { min: parseFloat(between[1]), max: parseFloat(between[2]), unit: between[3].toUpperCase() as 'F' | 'C' };

  const exact = question.match(/be\s*(-?\d+(?:\.\d+)?)\s*°\s*([FC])\s*on/i);
  if (exact) {
    const v = parseFloat(exact[1]);
    return { min: v, max: v, unit: exact[2].toUpperCase() as 'F' | 'C' };
  }
  return null;
}

function toCelsius(value: number, unit: 'F' | 'C'): number {
  if (!isFinite(value)) return value;
  return unit === 'F' ? ((value - 32) * 5) / 9 : value;
}

function distanceToRange(temp: number, minC: number, maxC: number): number {
  if (temp >= minC && temp <= maxC) return 0;
  if (temp < minC) return minC - temp;
  return temp - maxC;
}

// Weights for the bucket-selection composite score. Validated via out-of-sample
// backtest (259 real settled events across 9 cities, 60/40 train/test split):
// forecast-distance score (0.6) + whale NO-avoidance score (0.2) beats a pure
// forecast-only baseline on the same held-out test set — same win rate, but
// average ROI roughly 2x higher (+18.29% vs +8.08%). Historical/climatology
// was also tested (as a vote, as a confidence filter, as a composite weight
// at multiple recency windows, and as a pure tiebreaker) and consistently
// failed to add value or reversed direction between train/test splits — it is
// intentionally NOT included here. See memory/2026-07-07.md for full backtest
// methodology and results.
const FORECAST_WEIGHT = 0.6;
const WHALE_NO_AVOIDANCE_WEIGHT = 0.2;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: verifiedCities, error: vErr } = await supabaseAdmin
    .from('city_station_map')
    .select('city_name')
    .eq('is_verified', true);
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const verifiedBases = new Set(
    (verifiedCities || []).map((c: { city_name: string }) => c.city_name.split(',')[0].trim().toLowerCase())
  );

  const { data: markets, error: mErr } = await supabaseAdmin
    .from('markets')
    .select('*')
    .eq('status', 'active');
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // Pull recent whale activity for the NO-avoidance signal: for each market, how
  // much $ has whale-tier money (>=$500, tracked by fetch-wallet-activity) bet on
  // the NO side. A bucket that whales are NOT betting NO on is a mild positive
  // signal for that bucket being the outcome (whales avoid betting against likely winners).
  const { data: activity, error: aErr } = await supabaseAdmin
    .from('wallet_activity')
    .select('market_id, side, size_usd');
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const whaleNoCostByMarket = new Map<string, number>();
  for (const a of (activity || []) as { market_id: string; side: string; size_usd: number }[]) {
    if (a.side !== 'NO') continue;
    whaleNoCostByMarket.set(a.market_id, (whaleNoCostByMarket.get(a.market_id) || 0) + a.size_usd);
  }

  // Pull ALL forecasts in one query instead of one query per event in the loop
  // below — with 100+ events, per-event sequential queries blow past the
  // function's timeout budget (same root cause as the fetch-weather timeout
  // fixed earlier).
  const { data: forecastsRaw, error: fErr } = await supabaseAdmin
    .from('weather_forecasts')
    .select('city_name, target_date, predicted_temp');
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  const forecastByKey = new Map<string, number>();
  for (const f of (forecastsRaw || []) as { city_name: string; target_date: string; predicted_temp: number }[]) {
    forecastByKey.set(`${f.city_name}|${f.target_date}`, f.predicted_temp);
  }

  const events = new Map<string, Market[]>();
  for (const m of (markets || []) as Market[]) {
    const key = `${m.city_name}|${m.target_date}`;
    if (!events.has(key)) events.set(key, []);
    events.get(key)!.push(m);
  }

  const errors: string[] = [];
  const signalsToInsert: Record<string, unknown>[] = [];

  for (const [key, eventMarkets] of events) {
    const [cityName, targetDate] = key.split('|');

    const cityBase = cityName.split(',')[0].trim().toLowerCase();
    if (!verifiedBases.has(cityBase)) continue;

    const predictedTemp = forecastByKey.get(key);

    if (predictedTemp === undefined) {
      errors.push(`No forecast: ${key}`);
      continue;
    }

    const parsedMarkets = eventMarkets
      .map((m) => ({ ...m, range: parseTempRange(m.question) }))
      .filter((m): m is Market & { range: TempRange } => m.range !== null);

    if (parsedMarkets.length < 2) {
      errors.push(`Not enough parsable buckets: ${key}`);
      continue;
    }

    // Skip events where the outcome is already effectively decided: the highest
    // YES price across all buckets is what tracks certainty here, since a
    // multi-bucket temperature market ALWAYS has several near-0 buckets at the
    // tails (e.g. "85F or below") even while the event is fully live — that's
    // normal and does not mean the market is decided. Only the max price
    // converging to ~1 (one bucket essentially locked in) means the actual
    // temp has been observed and the market is no longer actionable.
    const maxYesPrice = Math.max(...parsedMarkets.map((m) => m.current_yes_price));
    if (maxYesPrice >= 0.98) {
      errors.push(`Skipped, market already effectively decided: ${key}`);
      continue;
    }

    // --- Composite bucket-selection score ---
    // 1. Forecast score: closer to the predicted temp = higher score (1 at distance 0).
    const distances = parsedMarkets.map((m) =>
      distanceToRange(predictedTemp, toCelsius(m.range.min, m.range.unit), toCelsius(m.range.max, m.range.unit))
    );
    const maxDistance = Math.max(...distances) || 1;

    // 2. Whale NO-avoidance score: buckets whales have NOT bet NO on score higher.
    const noCosts = parsedMarkets.map((m) => whaleNoCostByMarket.get(m.id) || 0);
    const maxNoCost = Math.max(...noCosts);

    let targetBucket = parsedMarkets[0];
    let bestScore = -Infinity;
    parsedMarkets.forEach((m, i) => {
      const forecastScore = 1 - distances[i] / maxDistance;
      const whaleNoScore = maxNoCost > 0 ? 1 - noCosts[i] / maxNoCost : 0.5;
      const combined = FORECAST_WEIGHT * forecastScore + WHALE_NO_AVOIDANCE_WEIGHT * whaleNoScore;
      if (combined > bestScore) {
        bestScore = combined;
        targetBucket = m;
      }
    });

    const otherMarkets = parsedMarkets.filter((m) => m.id !== targetBucket.id);
    let noCandidates = otherMarkets.filter(
      (m) => m.current_no_price >= 0.55 && m.current_no_price <= 0.85
    );
    if (noCandidates.length === 0) {
      noCandidates = [...otherMarkets]
        .sort((a, b) => Math.abs(a.current_no_price - 0.72) - Math.abs(b.current_no_price - 0.72))
        .slice(0, 3);
    }
    if (noCandidates.length === 0) {
      errors.push(`No NO candidates: ${key}`);
      continue;
    }

    const YES_CAP_PCT = 30;
    const NO_BUDGET_PCT = 70;
    const noSharePct = Math.round(NO_BUDGET_PCT / noCandidates.length);

    const strategyPackage = {
      positions: [
        {
          side: 'YES',
          question: targetBucket.question,
          polymarket_id: targetBucket.polymarket_id,
          entry_price: targetBucket.current_yes_price,
          allocation_pct: YES_CAP_PCT,
        },
        ...noCandidates.map((m) => ({
          side: 'NO',
          question: m.question,
          polymarket_id: m.polymarket_id,
          entry_price: m.current_no_price,
          allocation_pct: noSharePct,
        })),
      ],
    };

    const baselineProb = 1 / parsedMarkets.length;
    const netGap = Number(((baselineProb - targetBucket.current_yes_price) * 100).toFixed(2));

    let signalStatus: string;
    if (targetBucket.current_yes_price < 0.35 && netGap > 5) {
      signalStatus = 'GAP_FOUND';
    } else if (targetBucket.current_yes_price >= 0.35 && targetBucket.current_yes_price <= 0.6) {
      signalStatus = 'FAIR_PRICED';
    } else {
      signalStatus = 'NEUTRAL';
    }

    signalsToInsert.push({
      market_id: targetBucket.id,
      net_gap: netGap,
      signal_status: signalStatus,
      strategy_package: strategyPackage,
      is_premium: false,
    });
  }

  let inserted = 0;
  if (signalsToInsert.length > 0) {
    const { error } = await supabaseAdmin.from('gake_signals').insert(signalsToInsert);
    if (error) {
      errors.push(error.message);
    } else {
      inserted = signalsToInsert.length;
    }
  }

  return NextResponse.json({ inserted, errors, totalEvents: events.size });
}
