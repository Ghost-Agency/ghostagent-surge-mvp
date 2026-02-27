/// payments.ts — xDAI on-chain payment verification for NFTMail tier upgrades
///
/// Flow:
///   1. User sends xDAI from their wallet to TREASURY_SAFE on Gnosis (chain 100)
///   2. User pastes the tx hash into the upgrade UI
///   3. Server calls verifyXDAIPayment(txHash, expectedWei)
///   4. Checks: correct recipient, sufficient value, confirmed, not already used
///   5. Burns txHash in KV to prevent double-spend

import { createPublicClient, http, parseEther, type Hex } from 'viem';
import { gnosis } from 'viem/chains';

const WORKER_URL = process.env.NFTMAIL_WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';
const WEBHOOK_SECRET = process.env.NFTMAIL_WEBHOOK_SECRET || '';

// Treasury Safe on Gnosis — receives all tier upgrade payments
export const TREASURY_SAFE = (process.env.TREASURY_SAFE_ADDRESS || '0xb7e493e3d226f8fE722CC9916fF164B793af13F4').toLowerCase();

// Tier prices in xDAI (1 xDAI ≈ $1 USD)
export const TIER_PRICES_XDAI: Record<string, bigint> = {
  lite: parseEther('10'),
  premium: parseEther('24'),
  pro: parseEther('24'),
  ghost: parseEther('24'),
};

export const TIER_PRICES_USD: Record<string, number> = {
  lite: 10,
  premium: 24,
  pro: 24,
  ghost: 24,
};

export interface PaymentVerificationResult {
  valid: boolean;
  error?: string;
  txHash?: string;
  from?: string;
  value?: string;
  blockNumber?: number;
}

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com'),
});

/// Check if a txHash has already been used (double-spend prevention)
async function isTxHashBurned(txHash: string): Promise<boolean> {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkPaymentTx', txHash: txHash.toLowerCase() }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { used?: boolean };
    return data.used === true;
  } catch {
    return false;
  }
}

/// Burn a txHash in KV so it can never be reused
export async function burnTxHash(txHash: string, label: string, tier: string): Promise<void> {
  try {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recordPaymentTx',
        secret: WEBHOOK_SECRET,
        txHash: txHash.toLowerCase(),
        label,
        tier,
        recordedAt: Date.now(),
      }),
    });
  } catch {
    // Non-fatal — log and continue
    console.error('[burnTxHash] failed to burn txHash', txHash);
  }
}

/// Verify an xDAI payment tx on Gnosis chain
export async function verifyXDAIPayment(
  txHash: string,
  tier: string,
  minConfirmations = 2
): Promise<PaymentVerificationResult> {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { valid: false, error: 'Invalid tx hash format (must be 0x + 64 hex chars)' };
  }

  const expectedMinValue = TIER_PRICES_XDAI[tier];
  if (!expectedMinValue) {
    return { valid: false, error: `Unknown tier: ${tier}` };
  }

  // Double-spend check first (fast, no RPC needed)
  const burned = await isTxHashBurned(txHash);
  if (burned) {
    return { valid: false, error: 'This transaction has already been used to activate a tier upgrade' };
  }

  let tx: Awaited<ReturnType<typeof publicClient.getTransaction>>;
  try {
    tx = await publicClient.getTransaction({ hash: txHash as Hex });
  } catch {
    return { valid: false, error: 'Transaction not found on Gnosis chain. Check the hash and try again.' };
  }

  // Check recipient is treasury
  if (!tx.to || tx.to.toLowerCase() !== TREASURY_SAFE) {
    return {
      valid: false,
      error: `Payment must be sent to ${TREASURY_SAFE}. This tx was sent to ${tx.to?.toLowerCase() || 'unknown'}.`,
    };
  }

  // Check value >= expected
  if (tx.value < expectedMinValue) {
    const sentXdai = Number(tx.value) / 1e18;
    const expectedXdai = Number(expectedMinValue) / 1e18;
    return {
      valid: false,
      error: `Insufficient payment: sent ${sentXdai.toFixed(2)} xDAI, expected at least ${expectedXdai.toFixed(2)} xDAI`,
    };
  }

  // Check confirmations
  if (tx.blockNumber === null || tx.blockNumber === undefined) {
    return { valid: false, error: 'Transaction is still pending. Wait for it to confirm on Gnosis and try again.' };
  }

  try {
    const currentBlock = await publicClient.getBlockNumber();
    const confirmations = Number(currentBlock - tx.blockNumber);
    if (confirmations < minConfirmations) {
      return {
        valid: false,
        error: `Transaction has ${confirmations} confirmation${confirmations === 1 ? '' : 's'}. Please wait for ${minConfirmations} confirmations (~${minConfirmations * 5}s) and try again.`,
      };
    }
  } catch {
    // If block number check fails, proceed — the tx exists and block is set
  }

  return {
    valid: true,
    txHash: txHash.toLowerCase(),
    from: tx.from.toLowerCase(),
    value: (Number(tx.value) / 1e18).toFixed(4),
    blockNumber: tx.blockNumber ? Number(tx.blockNumber) : undefined,
  };
}
