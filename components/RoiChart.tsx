interface DataPoint {
  date: string;
  cumulative: number;
}

export default function RoiChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">
        No resolved events yet.
      </div>
    );
  }

  const width = 100;
  const height = 100;
  const values = data.map((d) => d.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width : (i / (data.length - 1)) * width;
    const y = height - ((d.cumulative - min) / range) * height;
    return `${x},${y}`;
  });

  const zeroY = height - ((0 - min) / range) * height;
  const last = data[data.length - 1];
  const isPositive = last.cumulative >= 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-40"
      >
        <line
          x1="0"
          y1={zeroY}
          x2={width}
          y2={zeroY}
          stroke="#3f3f46"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={isPositive ? "#34d399" : "#f87171"}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-mono">
        <span>{data[0].date}</span>
        <span className={isPositive ? "text-emerald-400" : "text-red-400"}>
          {isPositive ? "+" : ""}
          {last.cumulative}%
        </span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
