export default function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)] mt-16">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[color:var(--text-faint)]">
        <span>$GAKE watches the sky and bets on it — weather markets signal terminal for Polymarket.</span>
        <span>Not financial advice. All data informational only.</span>
      </div>
    </footer>
  );
}
