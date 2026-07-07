import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SEARCH_API = 'https://gamma-api.polymarket.com/public-search';

interface PolymarketMarket {
  id: string;
  conditionId: string;
  question: string;
  outcomePrices: string;
  closed: boolean;
  createdAt: string;
}

interface PolymarketEvent {
  title: string;
  markets: PolymarketMarket[];
}

function parseCityAndDate(eventTitle: string): { city: string; date: string } | null {
  const match = eventTitle.match(/Highest temperature in (.+?) on (.+?)\??$/i);
  if (!match) return null;
  return { city: match[1].trim(), date: match[2].trim() };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(
    `${SEARCH_API}?q=highest%20temperature&events_status=active&limit_per_type=100`
  );
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Polymarket events' }, { status: 502 });
  }
  const data = await res.json();
  const events: PolymarketEvent[] = data.events || [];

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const event of events) {
    const parsed = parseCityAndDate(event.title);
    if (!parsed) continue;

    const yearGuess = new Date().getFullYear();
    const targetDate = new Date(`${parsed.date}, ${yearGuess}`);
    if (isNaN(targetDate.getTime())) {
      errors.push(`Bad date parse: ${parsed.date}`);
      continue;
    }

    for (const market of event.markets) {
      let prices: string[];
      try {
        prices = JSON.parse(market.outcomePrices);
      } catch {
        errors.push(`Failed to parse prices for ${market.id}`);
        continue;
      }
      const [yesPrice, noPrice] = prices.map(Number);

      rows.push({
        city_name: parsed.city,
        target_date: targetDate.toISOString().split('T')[0],
        polymarket_id: market.id,
        condition_id: market.conditionId,
        question: market.question,
        current_yes_price: yesPrice,
        current_no_price: noPrice,
        status: market.closed ? 'settled' : 'active',
        opened_at: market.createdAt,
        updated_at: new Date().toISOString(),
      });
    }
  }

  let upserted = 0;
  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('markets')
      .upsert(rows, { onConflict: 'polymarket_id' });
    if (error) {
      errors.push(error.message);
    } else {
      upserted = rows.length;
    }
  }

  return NextResponse.json({ upserted, errors, totalEvents: events.length });
}
