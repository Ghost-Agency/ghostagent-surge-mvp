'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const OPENCLAW_TEMPLATE = 'https://github.com/sipeed/picoclaw';
const WORKER_DOCS = 'https://developers.cloudflare.com/workers/get-started/guide/';

interface AttachAgentProps {
  agentName: string;
  tbaAddress: string;
  emailAddress?: string;
}

type AttachStep = 'idle' | 'verifying' | 'attached' | 'error';

export function AttachAgent({ agentName, tbaAddress, emailAddress }: AttachAgentProps) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [step, setStep] = useState<AttachStep>('idle');
  const [workerUrl, setWorkerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [healthResult, setHealthResult] = useState<Record<string, any> | null>(null);

  const email = emailAddress || `${agentName}_@nftmail.box`;

  const verifyAndAttach = useCallback(async () => {
    if (!authenticated || wallets.length === 0) {
      setError('Connect your wallet first');
      return;
    }
    if (!workerUrl.trim()) {
      setError('Enter your worker URL');
      return;
    }

    setStep('verifying');
    setError(null);

    try {
      // Normalize URL
      let url = workerUrl.trim();
      if (!url.startsWith('http')) url = `https://${url}`;

      // Health check — POST to worker with a ping action
      const res = await fetch('/api/attach-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workerUrl: url,
          agentName,
          tbaAddress,
        }),
      });

      const data = await res.json() as Record<string, any>;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify worker');
      }

      setHealthResult(data);
      setStep('attached');
      setShowModal(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to worker');
      setStep('error');
    }
  }, [authenticated, wallets, workerUrl, agentName, tbaAddress]);

  return (
    <>
      <div className="space-y-4">
        {/* Step 1: Deploy from template */}
        <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(0,163,255,0.12)] text-xs font-bold text-[rgb(160,220,255)]">
              1
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Deploy OpenClaw Worker</div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Fork the template, set your agent name + TBA as env vars, deploy to Cloudflare Workers (free tier).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={OPENCLAW_TEMPLATE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/5"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub Template
                </a>
                <a
                  href={WORKER_DOCS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-white"
                >
                  CF Workers Docs ↗
                </a>
              </div>

              {/* Env vars hint */}
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/30 p-3">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">REQUIRED ENV VARS</div>
                <div className="mt-2 space-y-1 font-mono text-xs">
                  <div className="flex gap-2">
                    <span className="text-amber-300">AGENT_NAME</span>
                    <span className="text-[var(--muted)]">=</span>
                    <span className="text-emerald-300">{agentName}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-300">TBA_ADDRESS</span>
                    <span className="text-[var(--muted)]">=</span>
                    <span className="text-emerald-300">{tbaAddress.slice(0, 10)}...{tbaAddress.slice(-6)}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(tbaAddress)}
                      className="text-[var(--muted)] hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-300">NFTMAIL_ADDRESS</span>
                    <span className="text-[var(--muted)]">=</span>
                    <span className="text-emerald-300">{email}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Enter worker URL + verify */}
        <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(0,163,255,0.12)] text-xs font-bold text-[rgb(160,220,255)]">
              2
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Attach Worker to Agent</div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Paste your deployed worker URL. We&apos;ll verify it responds and link it to {agentName}.{' '}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={workerUrl}
                  onChange={(e) => { setWorkerUrl(e.target.value); setError(null); }}
                  placeholder="https://my-agent.username.workers.dev"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgba(0,163,255,0.5)]"
                />
                <button
                  onClick={verifyAndAttach}
                  disabled={step === 'verifying' || !workerUrl.trim()}
                  className="shrink-0 rounded-lg bg-[rgba(0,163,255,0.12)] px-4 py-2 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.2)] disabled:opacity-40"
                >
                  {step === 'verifying' ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Attach'
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}

              {step === 'attached' && !showModal && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Worker attached and responding
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-xs text-emerald-300/80">
              <strong>Cloud-native agent:</strong> OpenClaw JS Worker runs on Cloudflare free tier — zero dependencies, zero local install, zero cost.
              Communicates via A2A email ({email}) on the high-speed synthetic wire.
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            >
              <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/15 to-[rgba(0,163,255,0.15)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Agent Attached</h3>
                    <p className="text-xs text-[var(--muted)]">{agentName} is now cloud-native</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">WORKER URL</span>
                  <code className="break-all text-sm text-[rgb(160,220,255)]">{workerUrl}</code>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">AGENT EMAIL</span>
                  <code className="text-sm text-emerald-300">{email}</code>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">TBA</span>
                  <code className="break-all text-xs text-[var(--muted)]">{tbaAddress}</code>
                </div>

                {healthResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <div className="text-[10px] font-semibold tracking-wider text-emerald-300/70">HEALTH CHECK</div>
                    <div className="mt-1 text-xs text-emerald-300/80">
                      {healthResult.status === 'ok'
                        ? `Worker responded in ${healthResult.latencyMs || '?'}ms — agent is live.`
                        : `Worker responded: ${JSON.stringify(healthResult).slice(0, 100)}`}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
                  <p className="text-xs text-[var(--muted)]">
                    Your OpenClaw agent is now running in the cloud. It will receive A2A email at{' '}
                    <strong className="text-white">{email}</strong> and can execute tasks via its TBA.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-[rgba(0,163,255,0.12)] px-4 py-2 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.2)]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
