"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type SafeBalanceResponse = {
  safeAddress: string;
  chainId: number;
  balanceWei: string;
  balanceXdai: string;
};

type AgentAuditCardProps = {
  safeAddress: string;
  assets?: string[];
};

export default function AgentAuditCard({ safeAddress, assets }: AgentAuditCardProps) {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SafeBalanceResponse | null>(null);

  const ipAssets = useMemo(() => assets ?? ["ghostagent.ip", "openclaw.gno"], [assets]);

  useEffect(() => {
    const t = window.setTimeout(() => setScanning(false), 1500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/safe-balance?safeAddress=${encodeURIComponent(safeAddress)}`);
        const json = (await res.json()) as SafeBalanceResponse | { error: string };

        if (!res.ok) {
          const message = "error" in json ? json.error : "Failed to fetch balance";
          throw new Error(message);
        }

        if (!cancelled) setData(json as SafeBalanceResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (safeAddress) void run();

    return () => {
      cancelled = true;
    };
  }, [safeAddress]);

  const balance = useMemo(() => {
    const raw = data?.balanceXdai ?? "0";
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [data?.balanceXdai]);

  const gnosisPayReady = balance > 0.1;

  return (
    <section className="rounded-2xl border border-[rgba(0,163,255,0.32)] bg-[var(--card)]/90 p-6 shadow-[0_0_0_1px_rgba(0,163,255,0.10),0_40px_120px_rgba(0,0,0,0.60)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">AGENT PROOF-OF-CAPITAL</div>
          <div className="mt-2 text-sm text-[var(--muted)]">Safe: <span className="font-mono text-xs text-[rgb(180,190,210)]">{safeAddress}</span></div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              gnosisPayReady
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-[var(--muted)]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {gnosisPayReady ? "Gnosis Pay Ready" : "Gnosis Pay Not Ready"}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <AnimatePresence initial={false}>
          {scanning ? (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl border border-[var(--border)] bg-black/25 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Scanning Blockchain...</div>
                <div className="text-xs text-[var(--muted)]">Gnosis Chain</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full border border-[rgba(0,163,255,0.22)] bg-black/40">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "linear" }}
                  className="h-full bg-[linear-gradient(90deg,rgba(0,163,255,0.15),rgba(0,163,255,0.85),rgba(124,77,255,0.55))]"
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,163,255,0.22)] bg-black/20 p-5 shadow-[inset_0_0_0_1px_rgba(0,163,255,0.08)]">
          <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">XDAI BALANCE</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight">
            {loading ? "—" : balance.toFixed(4)}
            <span className="ml-2 text-base font-semibold text-[var(--muted)]">xDAI</span>
          </div>
          {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}
          {!error && !loading ? (
            <div className="mt-2 text-xs text-[var(--muted)]">Native balance read via Safe Protocol Kit</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">IP ASSETS</div>
            <div className="text-xs text-[var(--muted)]">{ipAssets.length}</div>
          </div>
          <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/30">
            <ul className="divide-y divide-[rgba(255,255,255,0.08)]">
              {ipAssets.map((a) => (
                <li key={a} className="px-4 py-3 text-sm">
                  <span className="font-mono text-[rgb(180,190,210)]">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
