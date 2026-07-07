import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

    const { data: forecast } = await supabaseAdmin
      .from('weather_forecasts')
      .select('predicted_temp')
      .eq('city_name', cityName)
      .eq('target_date', targetDate)
      .maybeSingle();

    if (!forecast) {
      errors.push(`No forecast: ${key}`);
      continue;
    }
    const predictedTemp = forecast.predicted_temp;

    const parsedMarkets = eventMarkets
      .map((m) => ({ ...m, range: parseTempRange(m.question) }))
      .filter((m): m is Market & { range: TempRange } => m.range !== null);

    if (parsedMarkets.length < 2) {
      errors.push(`Not enough parsable buckets: ${key}`);
      continue;
    }

    // Skip events where any bucket price is already at an extreme (>=0.98 or <=0.02).
    // A weather market can converge to a near-certain outcome (actual temp already
    // observed) well before Polymarket flips its `closed` flag — at that point the
    // package is no longer actionable (entry price ~1.00 = no real profit, only fees),
    // so we don't want to generate a misleading signal for it.
    const isDecided = parsedMarkets.some(
      (m) => m.current_yes_price >= 0.98 || m.current_yes_price <= 0.02
    );
    if (isDecided) {
      errors.push(`Skipped, market already effectively decided: ${key}`);
      continue;
    }

function distanceToRange(temp: number, minC: number, maxC: number): number {
  if (temp >= minC && temp <= maxC) return 0;
  if (temp < minC) return minC - temp;
  return temp - maxC;
}

let targetBucket = parsedMarkets[0];
let minDistance = Infinity;
for (const m of parsedMarkets) {
  const minC = toCelsius(m.range.min, m.range.unit);
  const maxC = toCelsius(m.range.max, m.range.unit);
  const d = distanceToRange(predictedTemp, minC, maxC);
  if (d < minDistance) {
    minDistance = d;
    targetBucket = m;
  }
}

    const otherMarkets = parsedMarkets.filter((m) => m.id !== targetBucket.id);let noCandidates = otherMarkets.filter(
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
