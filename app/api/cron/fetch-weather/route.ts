import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { geocodeCity } from '@/lib/geocode';

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

async function fetchOpenMeteoTemp(
  lat: number,
  lon: number,
  targetDate: string
): Promise<{ temp: number; stdDev: number | null } | null> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&timezone=auto&start_date=${targetDate}&end_date=${targetDate}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const temp = data.daily?.temperature_2m_max?.[0];
  if (temp === undefined || temp === null) return null;
  return { temp, stdDev: null };
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

  for (const { city_name, target_date } of uniqueKeys.values()) {
    const geo = await geocodeCity(city_name);
    if (!geo) {
      errors.push(`Geocode failed: ${city_name} (${target_date})`);
      continue;
    }

    const isUS = geo.countryCode === 'US';
    let tempC: number | null = null;
    let dataSource: string = '';
    let confidenceSource: string = '';
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
        errors.push(`Weather fetch failed (both NWS & Open-Meteo): ${city_name} (${target_date})`);
        continue;
      }
      tempC = result.temp;
      stdDev = result.stdDev;
      dataSource = 'OPEN_METEO';
      confidenceSource = 'ensemble_stddev';
    }

    const confidenceScore = stdDev !== null
      ? stdDev < 0.5 ? 'HIGH' : stdDev < 1.5 ? 'MEDIUM' : 'LOW'
      : 'MEDIUM';
      rows.push({
      city_name,
      target_date,
      predicted_temp: Number(tempC.toFixed(1)),
      temp_std_dev: stdDev,
      confidence_score: confidenceScore,
      data_source: dataSource,
      confidence_source: confidenceSource,
      updated_at: new Date().toISOString(),
    });
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

  return NextResponse.json({ upserted, errors, totalUniqueCityDates: uniqueKeys.size });
}