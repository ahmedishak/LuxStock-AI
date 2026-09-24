"use client";

import { useEffect, useState } from "react";

type HealthState = "checking" | "online" | "offline";

export function ApiHealthBadge() {
  const [status, setStatus] = useState<HealthState>("checking");
  const [openai, setOpenai] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          status?: string;
          openai_configured?: boolean;
        } | null;
        if (cancelled) return;
        if (response.ok && payload?.status === "ok") {
          setStatus("online");
          setOpenai(Boolean(payload.openai_configured));
        } else {
          setStatus("offline");
          setOpenai(null);
        }
      } catch {
        if (!cancelled) {
          setStatus("offline");
          setOpenai(null);
        }
      }
    }

    void ping();
    const id = window.setInterval(() => void ping(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const color =
    status === "online"
      ? "border-emerald/40 text-emerald"
      : status === "offline"
        ? "border-red-400/40 text-red-300"
        : "border-border text-muted";

  const label =
    status === "online"
      ? openai
        ? "API online · OpenAI ready"
        : "API online · template drafts"
      : status === "offline"
        ? "API offline"
        : "Checking API…";

  return (
    <span
      className={`hidden items-center gap-2 border px-2.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] sm:inline-flex ${color}`}
      title="Backend health from GET /api/health"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "online"
            ? "bg-emerald"
            : status === "offline"
              ? "bg-red-400"
              : "bg-muted"
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}
