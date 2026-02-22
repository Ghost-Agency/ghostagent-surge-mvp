/// Server-side Story L1 mint — treasury wallet signs mintSubdomain()
/// Called after user mints .agent.gno on Gnosis and gets a TBA address

import { createWalletClient, createPublicClient, http, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import StorySubRegistrarABI from '../abi/StorySubRegistrar.json';

const STORY_SUB_REGISTRAR = '0x3C1Aa0F0949E40cABbE4e14B1297DA50a4F6D7CA' as `0x${string}`;

const storyChain = defineChain({
  id: 1514,
  name: 'Story',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.storyrpc.io'] },
  },
  blockExplorers: {
    default: { name: 'StoryScan', url: 'https://www.storyscan.io' },
  },
});

export async function mintCreationIP(agentName: string, tbaAddress: `0x${string}`): Promise<{
  txHash: string;
  ipAccount?: string;
  fullDomain: string;
}> {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('Missing PRIVATE_KEY env var');

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}`);

  const walletClient = createWalletClient({
    chain: storyChain,
    transport: http(),
    account,
  });

  const publicClient = createPublicClient({
    chain: storyChain,
    transport: http(),
  });

  // Treasury wallet calls mintSubdomain(name, tbaAddress)
  const hash = await walletClient.writeContract({
    address: STORY_SUB_REGISTRAR,
    abi: StorySubRegistrarABI,
    functionName: 'mintSubdomain',
    args: [agentName, tbaAddress],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let ipAccount: string | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: StorySubRegistrarABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'IpAssetRegistered') {
        ipAccount = (decoded.args as any).ipAccount;
      }
    } catch {
      // Not our event
    }
  }

  return {
    txHash: hash,
    ipAccount,
    fullDomain: `${agentName}.creation.ip`,
  };
}
