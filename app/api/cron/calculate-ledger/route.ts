import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface StrategyPosition {
  side: 'YES' | 'NO';
  question: string;
  polymarket_id: string;
  entry_price: number;
  allocation_pct: number;
}

interface StrategyPackage {
  positions: StrategyPosition[];
}

interface SignalRow {
  id: string;
  market_id: string;
  strategy_package: StrategyPackage;
  created_at: string;
}

interface MarketRow {
  id: string;
  polymarket_id: string;
  city_name: string;
  target_date: string;
  question: string;
  status: string;
  current_yes_price: number;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: signalsRaw, error: sErr } = await supabaseAdmin
    .from('gake_signals')
    .select('*')
    .order('created_at', { ascending: false });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Keep only the latest signal per market_id (same dedup rule as dashboard)
  const latestByMarket = new Map<string, SignalRow>();
  for (const s of (signalsRaw || []) as SignalRow[]) {
    if (!latestByMarket.has(s.market_id)) latestByMarket.set(s.market_id, s);
  }

  const { data: allMarkets, error: mErr } = await supabaseAdmin
    .from('markets')
    .select('id, polymarket_id, city_name, target_date, question, status, current_yes_price');
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const marketByPolyId = new Map<string, MarketRow>();
  const marketById = new Map<string, MarketRow>();
  for (const m of (allMarkets || []) as MarketRow[]) {
    marketByPolyId.set(m.polymarket_id, m);
    marketById.set(m.id, m);
  }

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const signal of latestByMarket.values()) {
    const targetMarket = marketById.get(signal.market_id);
    if (!targetMarket) continue;

    const positions = signal.strategy_package?.positions || [];
    if (positions.length === 0) continue;

    // Only resolve once every position's underlying market has settled
    const resolvedPositions = positions.map((p) => ({
      p,
      market: marketByPolyId.get(p.polymarket_id),
    }));
    const allSettled = resolvedPositions.every((rp) => rp.market && rp.market.status === 'settled');
    if (!allSettled) continue;

    let netPnlPct = 0;
    for (const { p, market } of resolvedPositions) {
      if (!market) continue;
      const resolvedYes = market.current_yes_price >= 0.5;
      const won = p.side === 'YES' ? resolvedYes : !resolvedYes;
      const positionPnlPct = won ? (1 / p.entry_price - 1) : -1;
      netPnlPct += (p.allocation_pct / 100) * positionPnlPct;
    }
    netPnlPct = Number((netPnlPct * 100).toFixed(2));

    const resultStatus = netPnlPct >= 0 ? 'SUCCESS' : netPnlPct > -50 ? 'DEFENDED' : 'LOSS';

    rows.push({
      market_id: signal.market_id,
      city_name: targetMarket.city_name,
      target_date: targetMarket.target_date,
      question: targetMarket.question,
      net_pnl_pct: netPnlPct,
      result_status: resultStatus,
      strategy_package: signal.strategy_package,
      resolved_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('resolved_signals')
      .upsert(rows, { onConflict: 'market_id' });
    if (error) {
      errors.push(error.message);
    } else {
      inserted = rows.length;
    }
  }

  return NextResponse.json({ inserted, errors, totalSignalsChecked: latestByMarket.size });
}
