import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const client = createPublicClient({
  chain: gnosis,
  transport: http('https://rpc.gnosischain.com'),
});

// Placeholder — Safe deployment is handled by GhostRegistry.register() on-chain.
// This utility is kept for future programmatic Safe queries.
export async function getSafeBalance(safeAddress: `0x${string}`) {
  return client.getBalance({ address: safeAddress });
}
