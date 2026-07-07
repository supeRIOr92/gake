interface Stat {
  label: string;
  value: string;
  accent?: "green" | "red" | "purple";
}

const ACCENT_CLASS: Record<string, string> = {
  green: "text-[color:var(--green)]",
  red: "text-[color:var(--red)]",
  purple: "text-[color:var(--purple-bright)]",
};

export default function StatsBanner({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-center"
        >
          <div className="text-[10.5px] font-semibold text-[color:var(--text-faint)] uppercase tracking-wide mb-1.5">
            {s.label}
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl font-bold ${
              s.accent ? ACCENT_CLASS[s.accent] : "text-[color:var(--foreground)]"
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
