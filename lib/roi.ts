export interface Position {
  side: "YES" | "NO";
  question: string;
  polymarket_id: string;
  entry_price: number;
  allocation_pct: number;
}

// Computes the best-case and worst-case ROI of a hedging package, purely from
// the allocation/entry prices already locked into the package — no weather
// prediction or external assumption involved.
//
// Package shape: 1 YES position on the predicted bucket + several NO
// positions on other buckets (coverage/hedging).
//
// BEST CASE: actual temp lands exactly on the YES bucket -> YES wins AND
// every NO position also wins (since the actual bucket isn't any of them).
//
// WORST CASE: actual temp lands on one of the NO-covered buckets -> YES
// loses, that one NO loses, but the other NO positions still win. The worst
// scenario is whichever NO bucket, if it "hits", removes the LARGEST payout
// from the total (typically the cheapest-entry NO, since payout = alloc/price).
export function computeRoiRange(positions: Position[]): { bestRoi: number; worstRoi: number } {
  const totalAlloc = positions.reduce((sum, p) => sum + p.allocation_pct, 0) || 100;
  const payout = (p: Position) => p.allocation_pct / p.entry_price;

  const yes = positions.find((p) => p.side === "YES");
  const nos = positions.filter((p) => p.side === "NO");

  const bestPayout = (yes ? payout(yes) : 0) + nos.reduce((sum, p) => sum + payout(p), 0);
  const bestRoi = (bestPayout / totalAlloc - 1) * 100;

  let worstPayout: number;
  if (nos.length === 0) {
    worstPayout = 0;
  } else {
    worstPayout = Math.min(
      ...nos.map((excluded) =>
        nos.filter((p) => p !== excluded).reduce((sum, p) => sum + payout(p), 0)
      )
    );
  }
  const worstRoi = (worstPayout / totalAlloc - 1) * 100;

  return {
    bestRoi: Number(bestRoi.toFixed(1)),
    worstRoi: Number(worstRoi.toFixed(1)),
  };
}
