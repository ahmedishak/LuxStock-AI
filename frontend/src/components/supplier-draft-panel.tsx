"use client";

type DraftContext = {
  stockoutItem: string;
  trendingItem: string;
  recommendedQty?: number;
  category?: string;
  coverageWeeks?: number | null;
  revenueAtRisk?: number;
  unitsSold?: number;
  stockOnHand?: number;
  riskScore?: number;
  reason?: string;
} | null;

export function SupplierDraftPanel({
  open,
  draft,
  language,
  draftContext,
  isLoading,
  isApproving,
  approved,
  copied,
  onClose,
  onChangeDraft,
  onCopy,
  onApprove,
  onRegenerate,
}: {
  open: boolean;
  draft: string | null;
  language: string;
  draftContext: DraftContext;
  isLoading: boolean;
  isApproving: boolean;
  approved: boolean;
  copied: boolean;
  onClose: () => void;
  onChangeDraft: (value: string) => void;
  onCopy: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close draft panel"
        className={`absolute inset-0 bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-draft-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-gold/20 bg-[#0f0f0f] shadow-[0_0_60px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out sm:max-w-lg ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative overflow-hidden border-b border-gold/20 px-5 py-6 sm:px-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 70% 90% at 100% 0%, rgba(196,165,116,0.14), transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
                Merchandising desk
              </p>
              <h2
                id="supplier-draft-title"
                className="mt-2 font-display text-2xl font-medium tracking-tight text-foreground"
              >
                Supplier Email Draft
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Review, edit, then approve for the activity trail.
              </p>
              {draftContext && (
                <div className="mt-4 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.12em]">
                  <span className="border border-border px-2 py-1 text-muted">
                    {draftContext.stockoutItem}
                  </span>
                  {draftContext.recommendedQty != null && (
                    <span className="border border-gold/30 bg-gold-soft px-2 py-1 text-gold">
                      +{draftContext.recommendedQty} units
                    </span>
                  )}
                  {draftContext.revenueAtRisk ? (
                    <span className="border border-gold/30 bg-gold-soft px-2 py-1 text-gold">
                      ${draftContext.revenueAtRisk.toLocaleString()} at risk
                    </span>
                  ) : null}
                  {draftContext.coverageWeeks != null && (
                    <span className="border border-border px-2 py-1 text-muted">
                      {draftContext.coverageWeeks} wks cover
                    </span>
                  )}
                  <span className="border border-border px-2 py-1 text-muted">
                    {language.toUpperCase()}
                  </span>
                </div>
              )}
              {draftContext?.reason && (
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted">
                  {draftContext.reason}
                </p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 border border-border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:border-gold/45 hover:text-foreground"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {isLoading ? (
            <div className="lux-panel flex flex-col items-center justify-center gap-4 px-5 py-16 text-center">
              <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-gold/30 border-t-gold"
                aria-hidden
              />
              <p className="text-sm text-muted">Writing supplier email draft…</p>
            </div>
          ) : draft != null ? (
            <div className="flex flex-col gap-3">
              <label className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">
                Editable draft · {language.toUpperCase()}
              </label>
              <textarea
                value={draft}
                onChange={(e) => onChangeDraft(e.target.value)}
                rows={14}
                className="lux-panel min-h-[18rem] w-full resize-y border-gold/15 bg-transparent px-5 py-5 font-sans text-[0.95rem] leading-relaxed text-foreground/90 outline-none focus:border-gold/40"
              />
              {draftContext && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onRegenerate}
                  className="self-start text-[0.7rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
                >
                  Regenerate with current settings
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No supplier draft available yet.</p>
          )}
          {approved && (
            <p className="mt-4 text-sm text-emerald" role="status">
              Approved — logged to activity trail and queued for supplier send.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gold/20 bg-surface/80 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={!draft || isLoading}
              onClick={onCopy}
              className="flex-1 border border-border px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-foreground transition-colors hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy to Clipboard"}
            </button>
            <button
              type="button"
              disabled={!draft || isLoading || isApproving || approved}
              onClick={onApprove}
              className="flex-1 border border-gold/45 bg-gold-soft px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {approved ? "Approved" : isApproving ? "Approving…" : "Approve & Send"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
