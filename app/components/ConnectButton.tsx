'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function ConnectButton() {
  const { login, logout, authenticated, ready, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  if (authenticated && wallets.length > 0) {
    const addr = wallets[0].address;
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-emerald-300">
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
    );
  }

  if (authenticated && wallets.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
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
    <div className="flex flex-col gap-2">
      <button
        onClick={handleLogin}
        className="w-full rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-6 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)]"
      >
        Connect Wallet
      </button>
      {error && (
        <p className="text-xs text-amber-400">
          {error}
        </p>
      )}
    </div>
  );
}
