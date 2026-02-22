'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createWalletClient, createPublicClient, custom, http, encodeFunctionData, decodeEventLog } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { gnosis, GHOST_REGISTRY } from '../utils/chains';
import GhostRegistryABI from '../abi/GhostRegistry.json';

interface DeployTBAProps {
  agentName: string;
  safeAddress: `0x${string}`;
}

type DeployState = 'idle' | 'registering' | 'success' | 'error';

export function DeployTBA({ agentName, safeAddress }: DeployTBAProps) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState<DeployState>('idle');
  const [tbaAddress, setTbaAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const register = useCallback(async () => {
    if (!authenticated || wallets.length === 0) {
      setError('Connect your wallet first');
      return;
    }

    setState('registering');
    setError(null);

    try {
      const wallet = wallets[0];
      await wallet.switchChain(gnosis.id);
      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: gnosis,
        transport: custom(provider),
        account: wallet.address as `0x${string}`,
      });

      const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(),
      });

      // Call GhostRegistry.register(name, safe)
      // This mints NFT → creates TBA → swaps Safe owner to TBA, all on-chain
      const hash = await walletClient.writeContract({
        address: GHOST_REGISTRY,
        abi: GhostRegistryABI,
        functionName: 'register',
        args: [agentName, safeAddress],
      });

      setTxHash(hash);

      // Wait for tx confirmation and parse the Registered event
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Find the Registered event to extract the TBA address
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: GhostRegistryABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'Registered') {
            const args = decoded.args as any;
            setTbaAddress(args.tba);
            break;
          }
        } catch {
          // Not our event, skip
        }
      }

      setState('success');
      setShowModal(true);
    } catch (err: any) {
      console.error('Register failed:', err);
      setError(err?.shortMessage || err?.message || 'Registration failed');
      setState('error');
    }
  }, [authenticated, wallets, agentName, safeAddress]);

  if (!authenticated) return null;

  return (
    <>
      {/* Register Button */}
      <button
        onClick={register}
        disabled={state === 'registering'}
        className="flex items-center gap-2 rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-5 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'registering' ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
            </svg>
            Registering...
          </>
        ) : state === 'success' ? (
          <>
            <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Registered
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M12 12h.01" />
              <path d="M17 12h.01" />
              <path d="M7 12h.01" />
            </svg>
            Register Agent + Deploy TBA
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}

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
              {/* Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-[rgba(0,163,255,0.15)] to-[rgba(124,77,255,0.15)] px-6 py-5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Agent Registered</h3>
                    <p className="text-xs text-[var(--muted)]">{agentName}</p>
                  </div>
                </motion.div>
              </div>

              {/* Body */}
              <div className="space-y-4 px-6 py-5">
                {tbaAddress && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">
                      TOKEN BOUND ACCOUNT (TBA)
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="break-all text-sm text-[rgb(160,220,255)]">
                        {tbaAddress}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(tbaAddress)}
                        className="shrink-0 text-xs text-[var(--muted)] hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">
                    SAFE (NOW OWNED BY TBA)
                  </span>
                  <code className="break-all text-xs text-[var(--muted)]">
                    {safeAddress}
                  </code>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">
                    ON-CHAIN FLOW
                  </span>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-300">Mint NFT</span>
                    <span>→</span>
                    <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">Create TBA</span>
                    <span>→</span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">Swap Safe Owner</span>
                  </div>
                </div>

                {txHash && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">
                      TRANSACTION
                    </span>
                    <a
                      href={`https://gnosisscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[rgb(160,220,255)] hover:underline"
                    >
                      {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
                    </a>
                  </div>
                )}

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <p className="text-xs text-emerald-300/80">
                    GhostRegistry.register() minted the NFT, created the ERC-6551 TBA, and set it as the sole owner of the Safe — all in one transaction.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
                {txHash && (
                  <a
                    href={`https://gnosisscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[var(--border)] bg-black/30 px-4 py-2 text-xs text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
                  >
                    View on Gnosisscan
                  </a>
                )}
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
