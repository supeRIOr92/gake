function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/20 border border-[color:var(--border)] p-4 text-[13px] leading-relaxed">
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-10 py-8">
      <div className="flex items-start gap-4 mb-6">
        <span className="text-5xl leading-none select-none" aria-hidden>
          ☁️<span className="inline-block -ml-4 -mt-2 align-top text-2xl">🕶️</span>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-1.5">who (or what) is GAKE?</h1>
          <p className="text-[11px] uppercase tracking-widest text-[color:var(--purple-bright)] font-bold">
            the cloud that bets on itself
          </p>
        </div>
      </div>

      <p className="text-sm text-[color:var(--text-dim)] mb-9 leading-relaxed">
        GAKE (Get Alpha, Knock &apos;Em) watches the sky and bets on it — same
        forecast data, same on-chain whale signals, no feelings involved. We
        don&apos;t know if that&apos;s smart or unhinged. Probably both. GAKE
        scans every open weather market on Polymarket, compares it against
        live weather forecasts and detected smart-money activity, and
        surfaces two types of trade ideas below. GAKE never executes trades
        for you — you always copy the Contract ID and place orders manually
        on Polymarket.
      </p>

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          the safety blanket
        </h2>
        <div className="space-y-3 text-sm text-[color:var(--text-dim)] leading-relaxed">
          <p>
            Each weather market on Polymarket resolves based on the actual highest
            temperature recorded on a given day, split into narrow buckets (e.g. &quot;94-95°F&quot;,
            &quot;96-97°F&quot;). GAKE picks a likely bucket and builds a package around it. When
            a package is ready, a{" "}
            <span className="text-[color:var(--purple-bright)]">the safety blanket</span> badge
            appears, showing the package&apos;s Best Case and Worst Case ROI, plus{" "}
            <span className="text-[color:var(--purple-bright)]">gake&apos;s gut feeling</span> —
            how sure GAKE actually is, not just how big the upside looks.
          </p>
          <p>
            Instead of betting everything on one exact temperature, GAKE builds a small
            package of 2-4 positions spread across nearby buckets — typically weighted
            toward <span className="text-[color:var(--red)]">NO</span> on unlikely outcomes (cheaper,
            higher win-rate) with one <span className="text-[color:var(--green)]">YES</span> position
            on the most likely bucket. This mirrors the coverage style used by consistently
            profitable wallets we track on-chain: instead of a single directional bet, you
            hold a spread of outcomes so a small miss on the exact temperature doesn&apos;t wipe
            out the whole position — a literal safety blanket for when the forecast is wrong.
          </p>

          <ExampleBox>
            <p className="text-[color:var(--foreground)] font-semibold mb-2">
              Example — Houston, July 6
            </p>
            <p className="mb-1.5">
              GAKE expects Houston to likely hit 98-99°F. It builds this package:
            </p>
            <ul className="space-y-1 font-mono text-[12px]">
              <li>
                <span className="text-[color:var(--green)] font-bold">YES</span> &quot;Above 98°F&quot;
                — 30% budget @ 0.55
              </li>
              <li>
                <span className="text-[color:var(--red)] font-bold">NO</span> &quot;Above 102°F&quot;
                — 25% budget @ 0.88
              </li>
              <li>
                <span className="text-[color:var(--red)] font-bold">NO</span> &quot;Above 105°F&quot;
                — 25% budget @ 0.93
              </li>
              <li>
                <span className="text-[color:var(--red)] font-bold">NO</span> &quot;Below 90°F&quot;
                — 20% budget @ 0.91
              </li>
            </ul>
            <p className="mt-2 text-[12px]">
              If the actual high lands anywhere in the 90-102°F range, at least the YES
              position and most NO positions pay out — the package survives a forecast miss
              of a few degrees instead of losing everything on one exact bucket. The card
              shows both the Best Case (YES + all NO win) and Worst Case (YES loses, cheapest
              NO loses) ROI upfront, so you know the range before entering.
            </p>
          </ExampleBox>

          <p>
            <span className="text-[color:var(--foreground)] font-semibold">How to use it:</span> click a card
            in <span className="text-[color:var(--purple-bright)] font-semibold">other things gake is watching</span> to
            open its details, review the suggested allocation percentages, then
            copy each Contract ID and place the trades yourself on Polymarket. You decide
            your own budget and execution — $GAKE only tells you the split.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          watching whales
        </h2>
        <div className="space-y-3 text-sm text-[color:var(--text-dim)] leading-relaxed">
          <p>
            This is a completely different game from the safety blanket. Watching whales has
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

          <ExampleBox>
            <p className="text-[color:var(--foreground)] font-semibold mb-2">
              Example — Seoul, entry to exit
            </p>
            <ul className="space-y-1.5">
              <li>
                <span className="text-[color:var(--purple-bright)] font-semibold">1. fresh whale sightings</span>{" "}
                — Whale-37 detected buying <span className="text-[color:var(--red)] font-bold">NO</span> at
                0.82, 6 minutes ago, on a market opened 2 hours ago. You buy NO manually
                on Polymarket around the same price.
              </li>
              <li>
                <span className="text-[color:var(--purple-bright)] font-semibold">2. Wait</span> — you do
                nothing for the next ~27 hours (the historical median hold time before whales
                exit this type of position).
              </li>
              <li>
                <span className="text-[color:var(--purple-bright)] font-semibold">3. watch and pounce</span> —
                the market moves into the 24-48h bucket. Move on your position climbs to
                +38%, past the +30% mark on the progress bar. That&apos;s your cue: sell manually
                on Polymarket and lock in the gain — don&apos;t wait for the weather to actually
                settle.
              </li>
            </ul>
          </ExampleBox>

          <p>
            <span className="text-[color:var(--foreground)] font-semibold">How to use it:</span> watch{" "}
            <span className="text-[color:var(--purple-bright)] font-semibold">fresh whale sightings</span> for a
            market where a whale just entered — the newer, the closer you can match their entry
            price. Enter the same side manually on Polymarket. Once that market moves into{" "}
            <span className="text-[color:var(--purple-bright)] font-semibold">watch and pounce</span>, watch
            the Move percentage against the +30-50% historical target — the closer or past it,
            the more urgent it is to check and exit manually. You are not holding until
            settlement; you&apos;re trading the price correction itself.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--purple-bright)] mb-3 border-b border-[color:var(--border)] pb-2.5">
          gake's receipts
        </h2>
        <p className="text-sm text-[color:var(--text-dim)] leading-relaxed">
          Every safety-blanket package GAKE has ever surfaced is logged here once all of its
          underlying markets settle, with the real net ROI calculated from actual resolution
          prices — nothing curated or cherry-picked. This is the full track record, good and
          bad bets alike.
        </p>
      </section>
    </div>
  );
}
