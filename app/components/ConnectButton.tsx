'use client';

import { usePrivy } from '@privy-io/react-auth';

export function ConnectButton() {
  const { login, authenticated, ready } = usePrivy();

  if (!ready) return null;

  return (
    <button
      onClick={login}
      disabled={authenticated}
      className="w-full rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-6 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {authenticated ? 'Connected' : 'Continue'}
    </button>
  );
}
