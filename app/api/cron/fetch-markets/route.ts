import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const GAMMA_API = 'https://gamma-api.polymarket.com/events';

interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string; // JSON string array e.g. "[\"0.11\",\"0.89\"]"
  active: boolean;
  closed: boolean;
}

interface PolymarketEvent {
  title: string;
  markets: PolymarketMarket[];
}

function parseCityAndDate(title: string): { city: string; date: string } | null {
  const match = title.match(/Will the highest temperature in (.+?) be .+ on (.+)\?/i);
  if (!match) return null;
  return { city: match[1].trim(), date: match[2].trim() };
}

export async function GET() {
  const res = await fetch(`${GAMMA_API}?tag=temperature&active=true&closed=false&limit=200`);
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Polymarket events' }, { status: 502 });
  }
  const events: PolymarketEvent[] = await res.json();

  let upserted = 0;
  const errors: string[] = [];

  for (const event of events) {
    const parsed = parseCityAndDate(event.title);
    if (!parsed) continue;

    for (const market of event.markets) {
      let prices: string[];
      try {
        prices = JSON.parse(market.outcomePrices);
      } catch {
        errors.push(`Failed to parse prices for ${market.id}`);
        continue;
      }
      const [yesPrice, noPrice] = prices.map(Number);

      const { error } = await supabaseAdmin.from('markets').upsert(
        {
          city_name: parsed.city,
          target_date: new Date(parsed.date).toISOString().split('T')[0],
          polymarket_id: market.id,
          question: market.question,
          current_yes_price: yesPrice,
          current_no_price: noPrice,
          status: market.closed ? 'settled' : 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'polymarket_id' }
      );

      if (error) {
        errors.push(`${market.id}: ${error.message}`);
      } else {
        upserted++;
      }
    }
  }

  return NextResponse.json({ upserted, errors });
}
