import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { geocodeCity } from '@/lib/geocode';

export const maxDuration = 60;

interface NWSPointsResponse {
  properties: { forecast: string };
}
interface NWSForecastPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
}
interface NWSForecastResponse {
  properties: { periods: NWSForecastPeriod[] };
}

async function fetchNWSTemp(lat: number, lon: number, targetDate: string): Promise<number | null> {
  const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: { 'User-Agent': 'GAKE Weather Dashboard (contact: gake@example.com)' },
  });
  if (!pointsRes.ok) return null;
  const points: NWSPointsResponse = await pointsRes.json();

  const forecastRes = await fetch(points.properties.forecast, {
    headers: { 'User-Agent': 'GAKE Weather Dashboard (contact: gake@example.com)' },
  });
  if (!forecastRes.ok) return null;
  const forecast: NWSForecastResponse = await forecastRes.json();

  const period = forecast.properties.periods.find(
    (p) => p.isDaytime && p.startTime.startsWith(targetDate)
  );
  return period ? period.temperature : null;
}

// Ensemble of 4 independent forecast models, averaged. Validated via 259-event
// backtest against real settlements: ensemble MAE 1.75°F vs 2.11°F for a single
// "best_match" model (~17% more accurate), which translated to package ROI
// backtest improving from +16.03% to +29.18% average per event (259/259 events,
// spanning 1 year, 8 cities). See memory/2026-07-08.md for full methodology.
const ENSEMBLE_MODELS = ['gfs_seamless', 'ecmwf_ifs04', 'icon_seamless', 'gem_seamless'];

async function fetchOpenMeteoTemp(
  lat: number,
  lon: number,
  targetDate: string
): Promise<{ temp: number; stdDev: number | null } | null> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&timezone=auto&start_date=${targetDate}&end_date=${targetDate}&models=${ENSEMBLE_MODELS.join(',')}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const daily = data.daily as Record<string, (number | null)[]> | undefined;
  if (!daily) return null;

  const values: number[] = [];
  for (const model of ENSEMBLE_MODELS) {
    const v = daily[`temperature_2m_max_${model}`]?.[0];
    if (v !== undefined && v !== null) values.push(v);
  }
  if (values.length === 0) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { temp: mean, stdDev: Math.sqrt(variance) };
}

// Real-time observed temperature (NOT a forecast) — used for the "Current
// Conditions" section, which is intentionally decoupled from Polymarket
// market status (unlike predicted_temp, which only exists for city/date
// combos that have an active market). Fetched once per unique city, since
// current conditions don't depend on target_date.
async function fetchCurrentTemp(lat: number, lon: number): Promise<number | null> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const temp = data.current?.temperature_2m;
  const time = data.current?.time;
  if (temp === undefined || temp === null || !time) return null;
  return temp;
}

async function processOne(
  city_name: string,
  target_date: string,
  geocodeCache: Map<string, Awaited<ReturnType<typeof geocodeCity>>>
): Promise<{ row?: Record<string, unknown>; error?: string }> {
  let geo = geocodeCache.get(city_name);
  if (geo === undefined) {
    geo = await geocodeCity(city_name);
    geocodeCache.set(city_name, geo);
  }
  if (!geo) {
    return { error: `Geocode failed: ${city_name} (${target_date})` };
  }

  const isUS = geo.countryCode === 'US';
  let tempC: number | null = null;
  let dataSource = '';
  let confidenceSource = '';
  let stdDev: number | null = null;

  if (isUS) {
    const tempF = await fetchNWSTemp(geo.lat, geo.lon, target_date);
    if (tempF !== null) {
      tempC = ((tempF - 32) * 5) / 9;
      dataSource = 'NWS';
      confidenceSource = 'forecast_consistency';
    }
  }

  if (tempC === null) {
    const result = await fetchOpenMeteoTemp(geo.lat, geo.lon, target_date);
    if (!result) {
      return { error: `Weather fetch failed (both NWS & Open-Meteo): ${city_name} (${target_date})` };
    }
    tempC = result.temp;
    stdDev = result.stdDev;
    dataSource = 'OPEN_METEO';
    confidenceSource = 'ensemble_stddev';
  }

  const confidenceScore = stdDev !== null
    ? stdDev < 0.5 ? 'HIGH' : stdDev < 1.5 ? 'MEDIUM' : 'LOW'
    : 'MEDIUM';

  return {
    row: {
      city_name,
      target_date,
      predicted_temp: Number(tempC.toFixed(1)),
      temp_std_dev: stdDev,
      confidence_score: confidenceScore,
      data_source: dataSource,
      confidence_source: confidenceSource,
      updated_at: new Date().toISOString(),
    },
  };
}

async function processCurrentTemp(
  city_name: string,
  geocodeCache: Map<string, Awaited<ReturnType<typeof geocodeCity>>>
): Promise<{ row?: Record<string, unknown>; error?: string }> {
  let geo = geocodeCache.get(city_name);
  if (geo === undefined) {
    geo = await geocodeCity(city_name);
    geocodeCache.set(city_name, geo);
  }
  if (!geo) {
    return { error: `Geocode failed (current temp): ${city_name}` };
  }

  const temp = await fetchCurrentTemp(geo.lat, geo.lon);
  if (temp === null) {
    return { error: `Current temp fetch failed: ${city_name}` };
  }

  return {
    row: {
      city_name,
      current_temp_c: temp,
      observed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: markets, error: marketsError } = await supabaseAdmin
    .from('markets')
    .select('city_name, target_date')
    .eq('status', 'active');

  if (marketsError) {
    return NextResponse.json({ error: marketsError.message }, { status: 500 });
  }

  const uniqueKeys = new Map<string, { city_name: string; target_date: string }>();
  for (const m of markets || []) {
    uniqueKeys.set(`${m.city_name}|${m.target_date}`, m);
  }

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];
  // Same city often recurs across several target_dates — cache geocode per
  // city so we don't redo the same lookup dozens of times.
  const geocodeCache = new Map<string, Awaited<ReturnType<typeof geocodeCity>>>();

  // Sequentially awaiting every city/date combo one at a time (with each one
  // needing 1-3 network round trips) doesn't scale past a handful of markets
  // and was blowing past the cron runner's timeout once fetch-markets started
  // returning the full ~135 active city/date combos. Run in small concurrent
  // batches instead to keep wall-clock time bounded.
  const keys = Array.from(uniqueKeys.values());
  const BATCH_SIZE = 10;
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(({ city_name, target_date }) => processOne(city_name, target_date, geocodeCache))
    );
    for (const r of results) {
      if (r.error) errors.push(r.error);
      if (r.row) rows.push(r.row);
    }
  }

  let upserted = 0;
  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('weather_forecasts')
      .upsert(rows, { onConflict: 'city_name,target_date' });
    if (error) {
      errors.push(error.message);
    } else {
      upserted = rows.length;
    }
  }

  // Current (observed, real-time) temperature — one row per unique city,
  // independent of target_date/market status. Powers the homepage's "Current
  // Conditions" section, which intentionally does not reference Polymarket
  // markets at all (unlike the old "Live Weather Feed" it replaces).
  const uniqueCities = Array.from(new Set(keys.map((k) => k.city_name)));
  const currentRows: Record<string, unknown>[] = [];
  for (let i = 0; i < uniqueCities.length; i += BATCH_SIZE) {
    const batch = uniqueCities.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((city_name) => processCurrentTemp(city_name, geocodeCache))
    );
    for (const r of results) {
      if (r.error) errors.push(r.error);
      if (r.row) currentRows.push(r.row);
    }
  }

  let currentUpserted = 0;
  if (currentRows.length > 0) {
    const { error } = await supabaseAdmin
      .from('city_current_weather')
      .upsert(currentRows, { onConflict: 'city_name' });
    if (error) {
      errors.push(error.message);
    } else {
      currentUpserted = currentRows.length;
    }
  }

  return NextResponse.json({ upserted, currentUpserted, errors, totalUniqueCityDates: uniqueKeys.size });
}
