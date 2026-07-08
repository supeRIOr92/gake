import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const FRESH_HOURS = 24;
const AGING_HOURS = 48;

interface MarketRow {
  id: string;
  city_name: string;
  target_date: string;
  question: string;
  polymarket_id: string;
  current_yes_price: number;
  current_no_price: number;
  opened_at: string | null;
  status: string;
}

interface ActivityRow {
  id: string;
  wallet_label: string;
  market_id: string;
  side: string;
  entry_price: number;
  size_usd: number;
  tx_time: string;
}

function ageLabel(hoursOld: number): 'FRESH' | 'AGING' | 'STALE' {
  if (hoursOld < FRESH_HOURS) return 'FRESH';
  if (hoursOld < AGING_HOURS) return 'AGING';
  return 'STALE';
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: markets, error: mErr } = await supabaseAdmin
    .from('markets')
    .select('*')
    .eq('status', 'active')
    .not('opened_at', 'is', null);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const marketList = (markets || []) as MarketRow[];
  const now = Date.now();

  // Only consider markets younger than STALE window — scalp signal is irrelevant otherwise.
  // Also skip markets already at an extreme price (>=0.98 or <=0.02): a weather market can
  // converge to a near-certain outcome before Polymarket flips its `closed` flag, and at
  // that point there's no real mispricing left to scalp, only fees. Backtested against
  // real whale (onlylucknobrain) activity: entries at extreme prices never appear in that
  // whale's actual profitable scalp trades, so this guard matches real behavior, not just
  // a theoretical safeguard.
  const eligibleMarkets = marketList.filter((m) => {
    const hoursOld = (now - new Date(m.opened_at!).getTime()) / 3_600_000;
    const isDecided = m.current_yes_price >= 0.98 || m.current_yes_price <= 0.02;
    return hoursOld < AGING_HOURS && !isDecided;
  });

  const marketIds = eligibleMarkets.map((m) => m.id);
  const errors: string[] = [];

  let activity: ActivityRow[] = [];
  if (marketIds.length > 0) {
    const { data: activityRows, error: aErr } = await supabaseAdmin
      .from('wallet_activity')
      .select('*')
      .in('market_id', marketIds)
      .order('tx_time', { ascending: false });
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    activity = (activityRows || []) as ActivityRow[];
  }

  // Also guard on the entry price itself — a whale entry recorded at an extreme price
  // (>=0.98 or <=0.02) is stale/near-certain even if the market's current price has since
  // moved, so it shouldn't count as a genuine mispricing entry.
  const genuineActivity = activity.filter(
    (a) => a.entry_price < 0.98 && a.entry_price > 0.02
  );

  const activityByMarket = new Map<string, ActivityRow[]>();
  for (const a of genuineActivity) {
    if (!activityByMarket.has(a.market_id)) activityByMarket.set(a.market_id, []);
    activityByMarket.get(a.market_id)!.push(a);
  }

  const rows: Record<string, unknown>[] = [];

  for (const m of eligibleMarkets) {
    const marketActivity = activityByMarket.get(m.id);
    if (!marketActivity || marketActivity.length === 0) continue;

    const hoursOld = (now - new Date(m.opened_at!).getTime()) / 3_600_000;
    const latestEntry = marketActivity[0];

    rows.push({
      market_id: m.id,
      wallet_label: latestEntry.wallet_label,
      side: latestEntry.side,
      entry_price: latestEntry.entry_price,
      size_usd: latestEntry.size_usd,
      market_age_hours: Number(hoursOld.toFixed(1)),
      age_status: ageLabel(hoursOld),
      detected_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('scalp_signals')
      .upsert(rows, { onConflict: 'market_id' });
    if (error) {
      errors.push(error.message);
    } else {
      inserted = rows.length;
    }
  }

  return NextResponse.json({ inserted, errors, eligibleMarkets: eligibleMarkets.length });
}
