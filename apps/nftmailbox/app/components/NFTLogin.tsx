'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function NFTLogin() {
  const { login, logout, authenticated, ready, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const [error, setError] = useState<string | null>(null);

  const preferredWallet = wallets.find((w: any) => w?.walletClientType === 'injected') || wallets[0];

  if (!ready) return null;

  if (authenticated && wallets.length > 0) {
    const addr = preferredWallet.address;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-300">
              {addr.slice(0, 6)}...{addr.slice(-4)}
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-[var(--border)] bg-black/30 px-4 py-3 text-sm text-[var(--muted)] transition hover:border-red-500/30 hover:text-red-400"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (authenticated && wallets.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-amber-300">Logged in — connecting wallet...</span>
        </div>
        <button
          onClick={() => connectWallet()}
          className="w-full rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-6 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)]"
        >
          Connect External Wallet
        </button>
      </div>
    );
  }

  const handleLogin = async () => {
    setError(null);
    try {
      await login();
    } catch (err: any) {
      setError(err?.message || 'Connection failed. Try email login or a different wallet.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleLogin}
        className="group relative w-full overflow-hidden rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.08)] px-6 py-4 text-sm font-semibold text-[rgb(160,220,255)] transition-all hover:bg-[rgba(0,163,255,0.16)] hover:shadow-[0_0_32px_rgba(0,163,255,0.12)]"
      >
        <div className="flex items-center justify-center gap-3">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 8l-10 5L2 8" />
          </svg>
          NFT Login
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </button>
      <p className="text-center text-[10px] text-[var(--muted)]">Sign in to mint your nftmail.box address</p>
      {error && <p className="text-center text-xs text-amber-400">{error}</p>}
    </div>
  );
}
