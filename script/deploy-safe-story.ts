/// One-shot script: Deploy Gnosis Safe to Story L1 with same CREATE2 address
/// Usage: npx tsx script/deploy-safe-story.ts
///
/// Requires: PRIVATE_KEY env var (deployer 0x1c63C3... — a Safe owner)
///
/// The Safe on Gnosis was deployed with Safe v1.4.1 contracts:
///   Factory:         0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
///   Singleton:       0x41675C099F32341bf84BFc5382aF534df5C7461a
///   FallbackHandler: 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
///   SetupDelegate:   0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54
///   saltNonce:       0
///
/// All four contracts verified on Story L1 (chainId 1514) ✅

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// ─── Safe v1.4.1 (actual contracts used to deploy the Gnosis Safe) ───
const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as Address;
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address;

// ─── Target Safe ───
const GNOSIS_SAFE = '0xb7e493e3d226f8fe722cc9916ff164b793af13f4' as Address;

// ─── The EXACT setupData from the original Gnosis deployment ───
// Retrieved from Safe Transaction Service API /api/v1/safes/.../creation/
const ORIGINAL_SETUP_DATA = '0xb63e800d00000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000bd89a1ce4dde368ffab0ec35506eece0b1ffdc540000000000000000000000000000000000000000000000000000000000000160000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005afe7a11e700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000f251ca37a80200f7afeff398da0338f4c1f012490000000000000000000000001c63c3d9d211641e15cd3af46de76b4bc84cc3820000000000000000000000000000000000000000000000000000000000000024fe51f64300000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c76200000000000000000000000000000000000000000000000000000000' as Hex;

const SALT_NONCE = BigInt(0);

// ─── Chain ───
const storyL1 = defineChain({
  id: 1514, name: 'Story',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.storyrpc.io'] } },
  blockExplorers: { default: { name: 'StoryScan', url: 'https://www.storyscan.io' } },
});

// ─── ABI ───
const PROXY_FACTORY_ABI = [{
  name: 'createProxyWithNonce', type: 'function',
  inputs: [
    { name: '_singleton', type: 'address' },
    { name: 'initializer', type: 'bytes' },
    { name: 'saltNonce', type: 'uint256' },
  ],
  outputs: [{ name: 'proxy', type: 'address' }],
}] as const;

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY env var'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  console.log(`Deployer: ${account.address}`);

  const storyClient = createPublicClient({ chain: storyL1, transport: http() });

  // 1. Check deployer balance
  const balance = await storyClient.getBalance({ address: account.address });
  console.log(`Deployer $IP balance: ${Number(balance) / 1e18} IP`);

  // 2. Check if already deployed
  const existingCode = await storyClient.getCode({ address: GNOSIS_SAFE });
  if (existingCode && existingCode !== '0x') {
    console.log(`✅ Safe already deployed on Story L1 at ${GNOSIS_SAFE}`);
    process.exit(0);
  }
  console.log('Safe not yet deployed on Story L1. Deploying...');

  // 3. Deploy using exact same factory + singleton + setupData + saltNonce
  const walletClient = createWalletClient({ chain: storyL1, transport: http(), account });

  const txHash = await walletClient.writeContract({
    address: SAFE_PROXY_FACTORY,
    abi: PROXY_FACTORY_ABI,
    functionName: 'createProxyWithNonce',
    args: [SAFE_SINGLETON, ORIGINAL_SETUP_DATA, SALT_NONCE],
  });
  console.log(`TX submitted: ${txHash}`);
  console.log(`Explorer: https://www.storyscan.io/tx/${txHash}`);

  // 4. Wait for confirmation
  console.log('Waiting for confirmation...');
  const receipt = await storyClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}`);

  // 5. Verify deployment
  const deployedCode = await storyClient.getCode({ address: GNOSIS_SAFE });
  const deployed = !!deployedCode && deployedCode !== '0x';

  if (deployed) {
    console.log(`\n✅ SUCCESS: Safe deployed at ${GNOSIS_SAFE} on Story L1`);
    console.log(`   Same address as Gnosis — cross-chain identity preserved!`);
    console.log(`   Explorer: https://www.storyscan.io/address/${GNOSIS_SAFE}`);
  } else {
    console.log(`\n❌ FAILED: Safe NOT found at ${GNOSIS_SAFE}`);
    console.log('   The proxy may have been deployed at a different address.');
    console.log('   Check the tx receipt logs for the ProxyCreation event.');
  }
}

main().catch(console.error);
