'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function MintButton() {
  const { authenticated } = usePrivy();
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string>();

  async function mint() {
    if (!authenticated) return;
    setMinting(true);
    setError(undefined);

    try {
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.error('Mint failed:', err);
      setError(err instanceof Error ? err.message : 'Mint failed');
    } finally {
      setMinting(false);
    }
  }

  if (!authenticated) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={mint}
        disabled={minting}
        className="rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-6 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {minting ? 'Minting...' : 'Mint Agent'}
      </button>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
