import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SEARCH_API = 'https://gamma-api.polymarket.com/public-search';

interface PolymarketMarket {
  id: string;
  conditionId: string;
  question: string;
  outcomePrices?: string;
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

// The public-search API caps each response at ~50 events regardless of
// limit_per_type and requires paginating via `page` to get the rest — without
// this, many cities (whichever page they happen to land on) never get fetched
// at all, silently starving calculate-signals of active markets for them.
//
// IMPORTANT: Polymarket's events_status=active filter stops returning an
// event entirely once it settles — it does NOT come back with closed:true,
// it just disappears from this query. That meant markets never transitioned
// to status='settled' in our DB once their event resolved; they stayed
// 'active' forever, and calculate-signals kept reprocessing them indefinitely
// (confirmed: Beijing 2026-07-12 market generated 1900+ duplicate signal rows
// over 5 days after its event resolved). Also querying events_status=resolved
// (same pagination) fixes this: those events DO come back from that endpoint
// with closed:true, letting us upsert their true 'settled' status.
async function fetchAllEvents(status: 'active' | 'resolved'): Promise<PolymarketEvent[]> {
  const events: PolymarketEvent[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `${SEARCH_API}?q=highest%20temperature&events_status=${status}&limit_per_type=100&page=${page}`
    );
    if (!res.ok) break;
    const data = await res.json();
    const pageEvents: PolymarketEvent[] = data.events || [];
    if (pageEvents.length === 0) break;
    events.push(...pageEvents);
    if (pageEvents.length < 50) break;
  }
  return events;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [activeEvents, resolvedEvents] = await Promise.all([
    fetchAllEvents('active'),
    fetchAllEvents('resolved'),
  ]);
  // Resolved events are merged in AFTER active ones so that if the same
  // market somehow appears in both (shouldn't normally happen, but the API
  // is a live/shifting dataset), the resolved/closed status wins — a market
  // that Polymarket says is resolved should never be left marked active.
  const events = [...activeEvents, ...resolvedEvents];

  const errors: string[] = [];
  // Keyed by polymarket_id to dedupe: the paginated search API can return the
  // same market on more than one page (results shift slightly between
  // requests since the underlying data is live), and a duplicate id in the
  // same upsert batch makes Postgres reject the ENTIRE batch with
  // "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const rowsById = new Map<string, Record<string, unknown>>();

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
      // Illiquid markets (volume 0) omit outcomePrices entirely — skip them,
      // there's no price to record and nothing actionable to trade.
      if (!market.outcomePrices) continue;

      let prices: string[];
      try {
        prices = JSON.parse(market.outcomePrices);
      } catch {
        errors.push(`Failed to parse prices for ${market.id}`);
        continue;
      }
      const [yesPrice, noPrice] = prices.map(Number);

      rowsById.set(market.id, {
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

  const rows = Array.from(rowsById.values());

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

  return NextResponse.json({
    upserted,
    errors,
    totalEvents: events.length,
    activeEventCount: activeEvents.length,
    resolvedEventCount: resolvedEvents.length,
  });
}
