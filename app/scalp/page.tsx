import { supabase } from "@/lib/supabase";
import ScalpSignalCard from "@/components/ScalpSignalCard";
import ExpandableSection from "@/components/ExpandableSection";

export const revalidate = 60;

interface MarketRow {
  city_name: string;
  target_date: string;
  question: string;
  current_yes_price: number;
  current_no_price: number;
}

interface ScalpRow {
  id: string;
  market_id: string;
  wallet_label: string;
  side: string;
  entry_price: number;
  size_usd: number;
  market_age_hours: number;
  age_status: "FRESH" | "AGING" | "STALE";
  detected_at: string;
  markets: MarketRow;
}

async function getScalpSignals() {
  const { data } = await supabase
    .from("scalp_signals")
    .select("*, markets(*)")
    .order("market_age_hours", { ascending: true })
    .limit(200);
  return (data || []) as unknown as ScalpRow[];
}

export default async function ScalpPage() {
  const signals = await getScalpSignals();
  const fresh = signals.filter((s) => s.age_status === "FRESH");
  const aging = signals.filter((s) => s.age_status === "AGING");

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-1.5">Live Entry Alerts</h1>
      <p className="text-sm text-[color:var(--text-dim)] mb-7 leading-relaxed">
        Whale entries detected on fresh, potentially mispriced markets. Not directional
        weather bets — pure timing arbitrage. Exit manually once price re-corrects.
        Median hold time historically ~27 hours.
      </p>

      <ExpandableSection
        title="Fresh Entries (< 24h old)"
        totalCount={fresh.length}
        emptyText="No fresh whale entries detected right now."
      >
        {fresh.map((s) => (
          <ScalpSignalCard key={s.id} signal={s} />
        ))}
      </ExpandableSection>

      <ExpandableSection
        title="Aging Entries (24-48h old)"
        totalCount={aging.length}
        emptyText="No aging entries."
      >
        {aging.map((s) => (
          <ScalpSignalCard key={s.id} signal={s} />
        ))}
      </ExpandableSection>

      <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 mt-8 text-center">
        <p className="text-sm text-[color:var(--text-dim)] mb-3">
          Get pinged the moment a fresh mispricing or exit window appears.
        </p>
        <a
          href="https://t.me/"
          className="inline-block text-xs font-mono font-semibold px-4 py-2 rounded-full bg-gradient-to-br from-[#c9c0ff] to-[#ab9ff2] text-[#0e0b1a] hover:opacity-90 transition-opacity"
        >
          Connect Telegram Alerts
        </a>
      </div>
    </div>
  );
}
