import { supabase } from "@/lib/supabase";
import ScalpSectionClient from "@/components/ScalpSectionClient";
import type { ScalpMarket, ScalpEntry } from "@/components/ScalpMarketCard";

export const revalidate = 60;

const FRESH_HOURS = 24;
const AGING_HOURS = 48;

interface MarketRow {
  id: string;
  city_name: string;
  target_date: string;
  question: string;
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

async function getScalpMarkets() {
  const { data: marketsRaw } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "active")
    .not("opened_at", "is", null);

  const now = Date.now();
  // Skip markets already at an extreme price (>=0.98 or <=0.02) — no real mispricing
  // left to scalp at that point, only fees. Matches the same guard used for the
  // Hedging Package signal.
  const markets = (marketsRaw || []).filter((m: MarketRow) => {
    const hoursOld = (now - new Date(m.opened_at!).getTime()) / 3_600_000;
    const isDecided = m.current_yes_price >= 0.98 || m.current_yes_price <= 0.02;
    return hoursOld < AGING_HOURS && !isDecided;
  }) as MarketRow[];

  const marketIds = markets.map((m) => m.id);
  if (marketIds.length === 0) return { fresh: [] as ScalpMarket[], aging: [] as ScalpMarket[] };

  const { data: activityRaw } = await supabase
    .from("wallet_activity")
    .select("*")
    .in("market_id", marketIds)
    .order("tx_time", { ascending: false });

  // Also guard on the entry price itself — a whale entry recorded at an extreme price
  // is stale/near-certain even if the market's current price has since moved.
  const activity = ((activityRaw || []) as ActivityRow[]).filter(
    (a) => a.entry_price < 0.98 && a.entry_price > 0.02
  );
  const activityByMarket = new Map<string, ActivityRow[]>();
  for (const a of activity) {
    if (!activityByMarket.has(a.market_id)) activityByMarket.set(a.market_id, []);
    activityByMarket.get(a.market_id)!.push(a);
  }

  const fresh: ScalpMarket[] = [];
  const aging: ScalpMarket[] = [];

  for (const m of markets) {
    const marketActivity = activityByMarket.get(m.id);
    if (!marketActivity || marketActivity.length === 0) continue;

    const hoursOld = (now - new Date(m.opened_at!).getTime()) / 3_600_000;

    const entries: ScalpEntry[] = marketActivity.map((a) => {
      const currentPrice = a.side === "YES" ? m.current_yes_price : m.current_no_price;
      const movePct = ((currentPrice - a.entry_price) / a.entry_price) * 100;
      return {
        walletLabel: a.wallet_label,
        side: a.side,
        entryPrice: a.entry_price,
        sizeUsd: a.size_usd,
        txTime: a.tx_time,
        movePct,
      };
    });

    const scalpMarket: ScalpMarket = {
      marketId: m.id,
      cityName: m.city_name,
      targetDate: m.target_date,
      question: m.question,
      ageHours: hoursOld,
      entries,
      latestEntryTime: entries[0].txTime,
      maxMovePct: Math.max(...entries.map((e) => e.movePct)),
    };

    if (hoursOld < FRESH_HOURS) {
      fresh.push(scalpMarket);
    } else {
      aging.push(scalpMarket);
    }
  }

  // Fresh: newest whale entry first — closer to whale's exact entry timing
  fresh.sort((a, b) => new Date(b.latestEntryTime).getTime() - new Date(a.latestEntryTime).getTime());
  // Aging: largest Move first — closest to (or past) the ~30-50% historical exit target
  aging.sort((a, b) => b.maxMovePct - a.maxMovePct);

  return { fresh, aging };
}

export default async function ScalpPage() {
  const { fresh, aging } = await getScalpMarkets();

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-1.5">gake is watching whales</h1>
      <p className="text-sm text-[color:var(--text-dim)] mb-7 leading-relaxed">
        big money moving on markets so fresh they haven&apos;t settled into a fair
        price yet. this has nothing to do with the weather itself — gake is
        just watching who moves first. exit manually once price re-corrects.
        median hold time historically ~13 hours.
      </p>

      <ScalpSectionClient
        title="fresh whale sightings"
        subtitle="< 24h old — whale just entered, ranked by most recent. entries under 8h are gake's favorite — historically where the most profitable scalps started."
        markets={fresh}
        mode="fresh"
        emptyText="gake is sulking, no fresh whale entries right now."
      />

      <ScalpSectionClient
        title="watch and pounce"
        subtitle="24-48h old — ranked by how close price has moved toward the historical +30-50% exit target"
        markets={aging}
        mode="aging"
        emptyText="gake is sulking, nothing aging right now."
      />

      <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 mt-8 text-center">
        <p className="text-sm text-[color:var(--text-dim)] mb-3">
          get pinged the moment gake spots a whale moving.
        </p>
        <a
          href="https://t.me/"
          className="inline-block text-xs font-mono font-semibold px-4 py-2 rounded-full bg-gradient-to-br from-[#ffe14d] to-[#ffd21a] text-[#1a0f2e] hover:opacity-90 transition-opacity"
        >
          get gake in your DMs
        </a>
      </div>
    </div>
  );
}
