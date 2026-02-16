'use client';

import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

export default function AgentAuditCard({ safeAddress }: { safeAddress: string }) {
  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(process.env.NEXT_PUBLIC_GNOSIS_RPC)
  });
  const [balance, setBalance] = useState<bigint>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!safeAddress) return;
    
    async function fetchBalance() {
      setLoading(true);
      try {
        const bal = await publicClient.getBalance({ address: safeAddress });
        setBalance(bal);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, [safeAddress, publicClient]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
      <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">AUDIT</div>
      <div className="mt-2 text-2xl font-semibold">
        {loading ? (
          "Loading..."
        ) : balance === undefined ? (
          "Error"
        ) : (
          `${Number(formatEther(balance)).toFixed(4)} xDAI`
        )}
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">Native balance</div>
      <div className="mt-4 text-xs text-[var(--muted)]">
        {safeAddress === "0x0000000000000000000000000000000000000000"
          ? "Connect wallet to view agent audit data."
          : `Auditing Safe: ${safeAddress}`}
      </div>
    </div>
  );
}
