export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-1.5">What is GAKE?</h1>
      <p className="text-sm text-[color:var(--text-dim)] mb-9 leading-relaxed">
        GAKE (Get Alpha, Knock &apos;Em) scans every open weather market on Polymarket,
        compares it against live weather forecasts and detected smart-money activity,
        and surfaces two types of trade ideas below. GAKE never executes trades for you —
        you always copy the Contract ID and place orders manually on Polymarket.
      </p>

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          Hedging Package (Gap Radar)
        </h2>
        <div className="space-y-3 text-sm text-[color:var(--text-dim)] leading-relaxed">
          <p>
            Each weather market on Polymarket resolves based on the actual highest
            temperature recorded on a given day, split into narrow buckets (e.g. &quot;94-95°F&quot;,
            &quot;96-97°F&quot;). GAKE compares the market&apos;s current odds against a live weather
            forecast for that city and date. When the odds look mispriced relative to the
            forecast, a <span className="text-[color:var(--green)]">GAP FOUND</span> badge appears.
          </p>
          <p>
            Instead of betting everything on one exact temperature, GAKE builds a small
            package of 2-4 positions spread across nearby buckets — typically weighted
            toward <span className="text-[color:var(--red)]">NO</span> on unlikely outcomes (cheaper,
            higher win-rate) with one <span className="text-[color:var(--green)]">YES</span> position
            on the most likely bucket. This mirrors the coverage style used by consistently
            profitable wallets we track on-chain: instead of a single directional bet, you
            hold a spread of outcomes so a small miss on the exact temperature doesn&apos;t wipe
            out the whole position.
          </p>
          <p>
            <span className="text-[color:var(--foreground)] font-semibold">How to use it:</span> click a card
            in the Gap Radar to expand it, review the suggested allocation percentages, then
            copy each Contract ID and place the trades yourself on Polymarket. You decide
            your own budget and execution — GAKE only tells you the split.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          Scalp Signal
        </h2>
        <div className="space-y-3 text-sm text-[color:var(--text-dim)] leading-relaxed">
          <p>
            This is a completely different game from Hedging Package. Scalp Signal has
            nothing to do with predicting the weather — it&apos;s about catching mispricing in
            markets that just opened. When a weather market is fresh (usually under 24
            hours old), it hasn&apos;t been &quot;priced in&quot; properly yet, and odds can be off from
            where they&apos;ll eventually settle once more traders pile in.
          </p>
          <p>
            GAKE watches for large wallets (&quot;whales&quot;) entering these fresh markets early.
            Historically, when a tracked wallet enters a market under 24 hours old, the price
            tends to correct significantly within about 27 hours on average — regardless of
            what the actual weather turns out to be on settlement day.
          </p>
          <p>
            <span className="text-[color:var(--foreground)] font-semibold">How to use it:</span> watch the{" "}
            <span className="text-[color:var(--green)]">FRESH</span> list for a market where a whale
            just entered. Enter the same side manually on Polymarket, then watch the
            &quot;Move&quot; column — once the price has moved meaningfully in your favor, exit
            manually. You are not holding until settlement; you&apos;re trading the price
            correction itself.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          Ledger
        </h2>
        <p className="text-sm text-[color:var(--text-dim)] leading-relaxed">
          Every Hedging Package signal GAKE has ever surfaced is logged here once all of its
          underlying markets settle, with the real net ROI calculated from actual resolution
          prices — nothing curated or cherry-picked. This is the full track record, good and
          bad trades alike.
        </p>
      </section>
    </div>
  );
}
