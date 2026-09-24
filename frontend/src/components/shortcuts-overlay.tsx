"use client";

export function ShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const rows = [
    ["Shift + D", "Load the curated demo week"],
    ["1 / 2 / 3 / 4", "Overview · Analytics · Alerts · Settings"],
    ["?", "Toggle this cheat sheet"],
    ["Esc", "Close panels"],
  ];

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <button
        type="button"
        aria-label="Close shortcuts"
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="lux-panel absolute left-1/2 top-1/2 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 border-gold/25 px-6 py-6">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
          Keyboard
        </p>
        <h2 id="shortcuts-title" className="mt-2 font-display text-2xl text-foreground">
          Merchandising desk shortcuts
        </h2>
        <dl className="mt-5 divide-y divide-border">
          {rows.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3">
              <dt className="border border-border px-2 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-foreground/80">
                {key}
              </dt>
              <dd className="text-sm text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full border border-border px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:border-gold/45 hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
