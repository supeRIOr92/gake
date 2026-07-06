import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const TRADES_API = 'https://data-api.polymarket.com/trades';
const MIN_TRADE_USD = 500; // only track sizeable bets

interface PolyTrade {
  proxyWallet: string;
  side: 'BUY' | 'SELL';
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  transactionHash: string;
  outcome: string;
}

interface MarketRow {
  id: string;
  condition_id: string | null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: markets, error: mErr } = await supabaseAdmin
    .from('markets')
    .select('id, condition_id')
    .eq('status', 'active')
    .not('condition_id', 'is', null);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const marketByCondition = new Map<string, MarketRow>();
  for (const m of (markets || []) as MarketRow[]) {
    if (m.condition_id) marketByCondition.set(m.condition_id, m);
  }

  // Load wallet->alias mapping assigned in previous runs, so aliases stay stable
  // over time (same wallet always shows as the same "Whale-N", never the real address).
  const { data: aliasRows, error: aErr } = await supabaseAdmin
    .from('wallet_alias_map')
    .select('wallet_address, wallet_label');
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const knownAliases = new Map<string, string>();
  let nextAliasNumber = 1;
  for (const r of aliasRows || []) {
    knownAliases.set(r.wallet_address, r.wallet_label);
    const n = parseInt(r.wallet_label.replace('Whale-', ''), 10);
    if (!isNaN(n) && n >= nextAliasNumber) nextAliasNumber = n + 1;
  }

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];
  const newAliasRows: Record<string, unknown>[] = [];

  const res = await fetch(
    `${TRADES_API}?limit=500&filterType=CASH&filterAmount=${MIN_TRADE_USD}`
  );
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Polymarket trades' }, { status: 502 });
  }
  const trades: PolyTrade[] = await res.json();

  for (const t of trades) {
    const market = marketByCondition.get(t.conditionId);
    if (!market) continue;

    const sizeUsd = t.size * t.price;
    if (sizeUsd < MIN_TRADE_USD) continue;

    let label = knownAliases.get(t.proxyWallet);
    if (!label) {
      label = `Whale-${nextAliasNumber}`;
      nextAliasNumber += 1;
      knownAliases.set(t.proxyWallet, label);
      newAliasRows.push({ wallet_address: t.proxyWallet, wallet_label: label });
    }

    const side = t.outcome?.toUpperCase() === 'YES' ? 'YES' : t.outcome?.toUpperCase() === 'NO' ? 'NO' : t.side;

    rows.push({
      wallet_label: label,
      market_id: market.id,
      side,
      entry_price: t.price,
      tx_hash: t.transactionHash,
      size_usd: Number(sizeUsd.toFixed(2)),
      tx_time: new Date(t.timestamp * 1000).toISOString(),
    });
  }

  if (newAliasRows.length > 0) {
    const { error } = await supabaseAdmin
      .from('wallet_alias_map')
      .upsert(newAliasRows, { onConflict: 'wallet_address' });
    if (error) errors.push(`alias upsert: ${error.message}`);
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('wallet_activity')
      .upsert(rows, { onConflict: 'tx_hash' });
    if (error) {
      errors.push(error.message);
    } else {
      inserted = rows.length;
    }
  }

  return NextResponse.json({ inserted, errors, totalTradesScanned: trades.length });
}
