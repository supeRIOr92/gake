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

// Abramowitz-Stegun approximation of the error function (erf), used to compute
// the Gaussian CDF below. Max error ~1.5e-7, more than precise enough here.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
}

// Probability mass of Normal(mu, sigma) falling within [lo, hi].
function bucketProbability(lo: number, hi: number, mu: number, sigma: number): number {
  const loCdf = lo === -Infinity ? 0 : normalCdf(lo, mu, sigma);
  const hiCdf = hi === Infinity ? 1 : normalCdf(hi, mu, sigma);
  return Math.max(0, hiCdf - loCdf);
}

// Forecast error std dev (in Celsius), fitted from 259 real settled events
// across 9 cities (closed-bucket actual-temp reconstruction, open-ended tail
// buckets excluded to avoid biasing the estimate). Fitted on a 60% train
// split, validated out-of-sample on the held-out 40% test split: predicted
// probability bins of 90-100% matched an actual 81.8% win rate, and 20-30%
// bins matched an actual 24.2% win rate (n=11 and n=66 respectively) — the
// mid-probability range (30-70%) had too few samples to validate reliably.
// See memory/2026-07-08.md.
const FORECAST_ERROR_SIGMA_C = 1.95;

// Small secondary adjustment: buckets whales have NOT bet NO on get a mild
// boost. Kept as a tie-breaker/nudge only (not a probability), since this
// signal was validated for ROI improvement, not bucket-selection accuracy.
const WHALE_NO_AVOIDANCE_NUDGE = 0.05;

// Per-city forecast bias correction (Celsius), subtracted from the raw
// forecast before computing bucket probabilities. Fitted from real settled
// events for cities where a consistent, non-random directional bias was
// found (LA consistently over-forecasts hot by +3.59C; Chicago consistently
// under-forecasts by -1.51C). Cities not listed here had no significant bias
// detected and are left uncorrected (0).
const CITY_BIAS_CORRECTION_C: Record<string, number> = {
  'los angeles': 3.59,
  'chicago': -1.51,
};

// Cities where FORECAST_ERROR_SIGMA_C was actually fitted & validated against
// real settlement history (259 events, see comment above). All other cities
// (41+ added later via city_station_map ICAO verification) use the SAME sigma
// value as a working assumption, but that assumption has NOT been checked
// against their own settlement history yet — different climates (tropical,
// coastal, desert) could plausibly have different forecast-error spread.
// This flag is surfaced to the frontend so package_win_probability is never
// shown as equally "proven" for a city with zero backtest history behind it.
const SIGMA_VALIDATED_CITIES = new Set([
  'austin', 'chicago', 'denver', 'houston', 'los angeles', 'miami',
  'new york city', 'nyc', 'seattle', 'shanghai',
]);

interface Position {
  side: 'YES' | 'NO';
  entry_price: number;
  allocation_pct: number;
}

// Computes payout of a single position if it wins: allocation / entry_price
// (same formula used by lib/roi.ts on the frontend, kept consistent).
function payout(p: Position): number {
  return p.allocation_pct / p.entry_price;
}

// Package Win Probability: sums the Gaussian probability of every scenario
// (which bucket actually happens) that results in a NET PROFIT for the whole
// package — not just "did the YES bucket hit". This directly answers "if YES
// misses but every NO position was right, do we still come out ahead?" since
// that is exactly one of the scenarios summed here (see memory/2026-07-08.md
// package-level defensibility discussion).
//
// For each candidate bucket in the event (YES bucket, each covered NO bucket,
// and every uncovered "neither" bucket), we compute what the package payout
// would be IF the actual temperature landed in that bucket, compare to the
// 100% budget baseline, and if it's a net win we add that bucket's Gaussian
// probability to the total.
function computePackageWinProbability(
  allBucketsWithProb: { id: string; prob: number }[],
  yesId: string,
  noIds: string[],
  yesEntry: number,
  noEntries: Map<string, number>,
  yesAllocPct: number,
  noAllocPctEach: number
): number {
  const totalAlloc = yesAllocPct + noAllocPctEach * noIds.length;
  let winProb = 0;

  for (const bucket of allBucketsWithProb) {
    let packagePayout = 0;
    if (bucket.id === yesId) {
      // YES bucket hits: YES wins, every NO position also wins (the actual
      // bucket isn't any of them).
      packagePayout += yesAllocPct / yesEntry;
      for (const noId of noIds) {
        packagePayout += noAllocPctEach / (noEntries.get(noId) || 1);
      }
    } else if (noIds.includes(bucket.id)) {
      // This particular NO bucket hits: YES loses, THIS NO loses, the other
      // NO positions still win.
      for (const noId of noIds) {
        if (noId === bucket.id) continue;
        packagePayout += noAllocPctEach / (noEntries.get(noId) || 1);
      }
    } else {
      // Neither YES nor any covered NO bucket hits: YES loses, but ALL NO
      // positions win (this is the scenario the user asked about directly).
      for (const noId of noIds) {
        packagePayout += noAllocPctEach / (noEntries.get(noId) || 1);
      }
    }
    if (packagePayout > totalAlloc) {
      winProb += bucket.prob;
    }
  }

  return Math.max(0, Math.min(1, winProb));
}

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

    const rawPredictedTemp = forecastByKey.get(key);

    if (rawPredictedTemp === undefined) {
      errors.push(`No forecast: ${key}`);
      continue;
    }

    const biasCorrection = CITY_BIAS_CORRECTION_C[cityBase] || 0;
    const predictedTemp = rawPredictedTemp - biasCorrection;

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

    // --- Bucket-selection: Gaussian probability model ---
    // Each bucket's true probability = area under a Normal(predictedTemp, sigma)
    // curve within that bucket's temp range. Unlike a per-event-normalized
    // score, this is comparable ACROSS events (a 0.8 here means the same thing
    // as a 0.8 on a different event/city), because it isn't rescaled relative
    // to sibling buckets.
    const rawProbs = parsedMarkets.map((m) =>
      bucketProbability(
        toCelsius(m.range.min, m.range.unit),
        toCelsius(m.range.max, m.range.unit),
        predictedTemp,
        FORECAST_ERROR_SIGMA_C
      )
    );
    const totalProb = rawProbs.reduce((a, b) => a + b, 0) || 1;
    const normalizedProbs = rawProbs.map((p) => p / totalProb);
    const noCosts = parsedMarkets.map((m) => whaleNoCostByMarket.get(m.id) || 0);
    const maxNoCost = Math.max(...noCosts);

    let targetBucket = parsedMarkets[0];
    let bestScore = -Infinity;
    let targetConfidence = 0;
    parsedMarkets.forEach((m, i) => {
      const probability = normalizedProbs[i];
      const whaleNoScore = maxNoCost > 0 ? 1 - noCosts[i] / maxNoCost : 0.5;
      const combined = probability + WHALE_NO_AVOIDANCE_NUDGE * whaleNoScore;
      if (combined > bestScore) {
        bestScore = combined;
        targetBucket = m;
        targetConfidence = probability;
      }
    });

    const otherMarkets = parsedMarkets.filter((m) => m.id !== targetBucket.id);
    // Always aim for 3 NO positions (hedge coverage). Prefer buckets priced in the
    // 0.55-0.85 "sweet spot" first, then top up any remaining slots with the
    // next-closest-to-0.72 buckets not already picked — a partial sweet-spot match
    // (e.g. only 1 bucket in range) must NOT stop at 1, it must still fill up to 3.
    const inSweetSpot = otherMarkets.filter(
      (m) => m.current_no_price >= 0.55 && m.current_no_price <= 0.85
    );
    const restSortedByCloseness = otherMarkets
      .filter((m) => !inSweetSpot.some((s) => s.id === m.id))
      .sort((a, b) => Math.abs(a.current_no_price - 0.72) - Math.abs(b.current_no_price - 0.72));
    const noCandidates = [...inSweetSpot, ...restSortedByCloseness].slice(0, 3);
    if (noCandidates.length === 0) {
      errors.push(`No NO candidates: ${key}`);
      continue;
    }

    const YES_CAP_PCT = 30;
    const NO_BUDGET_PCT = 70;
    const noSharePct = Math.round(NO_BUDGET_PCT / noCandidates.length);

    // --- Package Win Probability (new) ---
    // Unlike targetConfidence (which only reflects "does the YES bucket hit"),
    // this sums the Gaussian probability of EVERY scenario that leaves the
    // whole package net-positive, including the scenario where YES misses but
    // all 3 NO positions win (see memory/2026-07-08.md — user-requested check
    // on whether "YES loses, all NO correct" is automatically profitable; it
    // is NOT automatic, it depends on NO entry prices, hence this computation).
    const allBucketsWithProb = parsedMarkets.map((m, i) => ({ id: m.id, prob: normalizedProbs[i] }));
    const noEntries = new Map(noCandidates.map((m) => [m.id, m.current_no_price]));
    const packageWinProbability = computePackageWinProbability(
      allBucketsWithProb,
      targetBucket.id,
      noCandidates.map((m) => m.id),
      targetBucket.current_yes_price,
      noEntries,
      YES_CAP_PCT,
      noSharePct
    );

    const sigmaValidated = SIGMA_VALIDATED_CITIES.has(cityBase);

    const strategyPackage = {
      confidence: Number(targetConfidence.toFixed(3)),
      package_win_probability: Number(packageWinProbability.toFixed(3)),
      sigma_validated: sigmaValidated,
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
