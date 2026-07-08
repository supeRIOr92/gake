import SignalCard, { type Signal } from "@/components/SignalCard";
import HeroSignalCard from "@/components/HeroSignalCard";
import ExpandableSection from "@/components/ExpandableSection";
import SharpMoneySidebar from "@/components/SharpMoneySidebar";
import StatsBanner from "@/components/StatsBanner";
import Link from "next/link";

export const revalidate = 60;

function mockSignal(id: string, city: string): Signal & { markets: any } {
  return {
    id,
    market_id: id,
    net_gap: -30,
    signal_status: "GAP_FOUND",
    strategy_package: {
      positions: [
        { side: "YES", question: `Will ${city} be 34°C on July 8?`, polymarket_id: "280109" + id, entry_price: 0.28, allocation_pct: 30 },
        { side: "NO", question: `Will ${city} be 32°C on July 8?`, polymarket_id: "280110" + id, entry_price: 0.60, allocation_pct: 23 },
        { side: "NO", question: `Will ${city} be 33°C on July 8?`, polymarket_id: "280111" + id, entry_price: 0.68, allocation_pct: 23 },
        { side: "NO", question: `Will ${city} be 35°C on July 8?`, polymarket_id: "280112" + id, entry_price: 0.75, allocation_pct: 24 },
      ],
    },
    created_at: new Date().toISOString(),
    markets: { city_name: city, target_date: "2026-07-08", question: `Will ${city} hit a new high?`, current_yes_price: 0.28 },
  };
}

export default async function Home() {
  const signals = [mockSignal("1", "Houston"), mockSignal("2", "Austin")];
  const topSignal = signals[0];
  const restSignals = signals.slice(1);

  const activity = [
    { id: "a1", wallet_label: "Whale-37", side: "NO", entry_price: 0.82, size_usd: 950, tx_time: new Date().toISOString(), markets: { city_name: "Seoul", target_date: "2026-07-08" } },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-10 py-8 flex flex-col lg:flex-row gap-7">
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-[color:var(--text-dim)] leading-relaxed mb-6 max-w-2xl">
          GAKE scans every open weather market on Polymarket and surfaces mispricing.{" "}
          <Link href="/about" className="text-[color:var(--purple-bright)] font-semibold">
            How it works →
          </Link>
        </p>

        <StatsBanner
          stats={[
            { label: "Signals Live", value: String(signals.length) },
            { label: "Resolved Events", value: "142" },
            { label: "Win Rate", value: "62.7%", accent: "green" },
            { label: "Avg ROI / Event", value: "+15.7%", accent: "green" },
          ]}
        />

        {topSignal && <HeroSignalCard signal={topSignal} market={topSignal.markets} />}

        <ExpandableSection title="Gap Radar" totalCount={restSignals.length}>
          {restSignals.map((s) => (
            <SignalCard key={s.id} signal={s} market={s.markets} />
          ))}
        </ExpandableSection>
      </div>

      <SharpMoneySidebar activity={activity as any} />
    </div>
  );
}
