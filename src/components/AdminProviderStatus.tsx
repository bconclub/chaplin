"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderStatus } from "@/app/api/admin/providers/route";

function StateDot({ provider }: { provider: ProviderStatus }) {
  const [tone, label] = !provider.configured
    ? ["bg-amber-400", "Not configured"]
    : provider.reachable === false
      ? ["bg-red-400", "Failing"]
      : provider.reachable === true
        ? ["bg-emerald-400", "Connected"]
        : ["bg-white/35", "Not probed"];
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={label}>
      <span className={`h-2 w-2 rounded-full ${tone} ${provider.reachable === true ? "animate-pulse" : ""}`} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-grey">{label}</span>
    </span>
  );
}

/**
 * Live provider readiness beside the generation logs.
 *
 * Only real figures are shown: ElevenLabs publishes a character quota, so it
 * gets a usage bar; the others expose no balance endpoint, so they report
 * connected or failing rather than an invented number. A missing key reads
 * differently from a rejected one because the fix is different.
 */
export default function AdminProviderStatus() {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/providers", { cache: "no-store" });
      const data = await response.json() as { providers?: ProviderStatus[]; checkedAt?: string; error?: string };
      if (response.status === 401 || response.status === 403) {
        throw new Error(data.error || "Sign in as Super Admin to view provider status.");
      }
      if (!response.ok) throw new Error(data.error || "Could not read provider status.");
      setProviders(data.providers ?? []);
      setCheckedAt(data.checkedAt ?? "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not read provider status.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Deferred a frame so the effect body never sets state synchronously.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const unconfigured = (providers ?? []).filter((provider) => !provider.configured);
  const failing = (providers ?? []).filter((provider) => provider.reachable === false);

  return (
    <section className="poster-card rounded-md p-5" data-admin-provider-status>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Provider readiness</p>
          <h2 className="reel-title mt-1 text-2xl">Connections</h2>
          <p className="mt-1 text-xs text-grey">
            {checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString()}` : "Checking live…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-xs hover:border-accent disabled:opacity-40"
        >
          {busy ? "Checking…" : "Re-check"}
        </button>
      </div>

      {(unconfigured.length > 0 || failing.length > 0) && (
        <p className="mb-4 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
          {failing.length > 0 && <><strong>{failing.map((p) => p.label).join(", ")}</strong> failing. </>}
          {unconfigured.length > 0 && <><strong>{unconfigured.map((p) => p.label).join(", ")}</strong> not configured — generation using them will fail.</>}
        </p>
      )}

      {error && <p className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">{error}</p>}

      <ul className="grid gap-2.5">
        {(providers ?? []).map((provider) => (
          <li key={provider.id} className="rounded-lg border border-line bg-black/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{provider.label}</p>
                <p className="truncate text-[10px] text-grey">{provider.purpose}</p>
              </div>
              <StateDot provider={provider} />
            </div>
            {provider.quota && (
              <div className="mt-2.5">
                <div className="flex items-baseline justify-between text-[10px]">
                  <span className="text-grey">{provider.quota}</span>
                  {provider.usedRatio !== null && (
                    <span className={provider.usedRatio > 0.9 ? "font-semibold text-red-300" : "text-grey"}>
                      {Math.round(provider.usedRatio * 100)}% used
                    </span>
                  )}
                </div>
                {provider.usedRatio !== null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${provider.usedRatio > 0.9 ? "bg-red-400" : provider.usedRatio > 0.7 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.round(provider.usedRatio * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {provider.detail && <p className="mt-2 text-[10px] leading-4 text-grey">{provider.detail}</p>}
          </li>
        ))}
        {!providers && !error && <li className="text-xs text-grey">Probing providers…</li>}
      </ul>
    </section>
  );
}
