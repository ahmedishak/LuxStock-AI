"use client";

export function RiskDonut({
  critical,
  watch,
  healthy,
}: {
  critical: number;
  watch: number;
  healthy: number;
}) {
  const total = critical + watch + healthy;
  if (!total) {
    return (
      <p className="text-sm text-muted">No SKU mix until a week is loaded.</p>
    );
  }

  const cPct = (critical / total) * 100;
  const wPct = (watch / total) * 100;

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-28 w-28 shrink-0"
        style={{
          background: `conic-gradient(#b45454 0 ${cPct}%, #c4a574 ${cPct}% ${cPct + wPct}%, #2f6b5a ${cPct + wPct}% 100%)`,
        }}
        aria-hidden
      >
        <div className="absolute inset-[18%] bg-surface-elevated" />
        <p className="absolute inset-0 flex items-center justify-center font-display text-xl text-foreground">
          {total}
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 bg-[#b45454]" aria-hidden />
          Critical · {critical}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 bg-gold" aria-hidden />
          Watch · {watch}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 bg-emerald" aria-hidden />
          Healthy · {healthy}
        </li>
      </ul>
    </div>
  );
}
