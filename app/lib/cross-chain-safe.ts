/// Cross-Chain Safe Deployment: Deploy the SAME Safe address to Story L1 (chainId 1514)
/// Uses Safe v1.3.0 canonical factories (CREATE2 deterministic addressing)
///
/// Flow:
///   1. Read existing Safe config from Gnosis (owners, threshold)
///   2. Compute the same CREATE2 address using the same salt + initCode
///   3. Deploy on Story L1 via ProxyFactory.createProxyWithNonce()
///   4. Safe now controls IP Assets directly on Story chain
///
/// Prerequisites:
///   - Safe v1.3.0 canonical contracts deployed on Story L1 ✅ (verified)
///   - Treasury wallet has IP tokens on Story L1 for gas

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodePacked,
  keccak256,
  getContractAddress,
  concat,
  pad,
  toHex,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// ─── Safe v1.3.0 Canonical Addresses (same on all EVM chains) ───
const SAFE_SINGLETON = '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552' as Address;
const SAFE_PROXY_FACTORY = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2' as Address;
const SAFE_FALLBACK_HANDLER = '0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4' as Address;

// ─── Chain Definitions ───
const gnosis = defineChain({
  id: 100,
  name: 'Gnosis',
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.gnosischain.com'] } },
  blockExplorers: { default: { name: 'Gnosisscan', url: 'https://gnosisscan.io' } },
});

const storyL1 = defineChain({
  id: 1514,
  name: 'Story',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.storyrpc.io'] } },
  blockExplorers: { default: { name: 'StoryScan', url: 'https://www.storyscan.io' } },
});

// ─── Safe ABI fragments ───
const SAFE_SETUP_ABI = [{
  name: 'setup',
  type: 'function',
  inputs: [
    { name: '_owners', type: 'address[]' },
    { name: '_threshold', type: 'uint256' },
    { name: 'to', type: 'address' },
    { name: 'data', type: 'bytes' },
    { name: 'fallbackHandler', type: 'address' },
    { name: 'paymentToken', type: 'address' },
    { name: 'payment', type: 'uint256' },
    { name: 'paymentReceiver', type: 'address' },
  ],
  outputs: [],
}] as const;

const PROXY_FACTORY_ABI = [{
  name: 'createProxyWithNonce',
  type: 'function',
  inputs: [
    { name: '_singleton', type: 'address' },
    { name: 'initializer', type: 'bytes' },
    { name: 'saltNonce', type: 'uint256' },
  ],
  outputs: [{ name: 'proxy', type: 'address' }],
}, {
  name: 'proxyCreationCode',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: 'bytes' }],
}] as const;

const SAFE_INFO_ABI = [{
  name: 'getOwners',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: 'address[]' }],
}, {
  name: 'getThreshold',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  name: 'nonce',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

// ─── Types ───
export interface SafeConfig {
  owners: Address[];
  threshold: number;
}

export interface CrossChainDeployResult {
  gnosisSafeAddress: Address;
  storyPredictedAddress: Address;
  storyDeployedAddress: Address;
  txHash: Hex;
  matched: boolean;
  owners: Address[];
  threshold: number;
}

// ─── Read Safe config from Gnosis ───
export async function readGnosisSafeConfig(safeAddress: Address): Promise<SafeConfig> {
  const client = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  const [owners, threshold] = await Promise.all([
    client.readContract({
      address: safeAddress,
      abi: SAFE_INFO_ABI,
      functionName: 'getOwners',
    }),
    client.readContract({
      address: safeAddress,
      abi: SAFE_INFO_ABI,
      functionName: 'getThreshold',
    }),
  ]);

  return {
    owners: owners as Address[],
    threshold: Number(threshold),
  };
}

// ─── Encode Safe setup initializer ───
function encodeSafeSetup(owners: Address[], threshold: number): Hex {
  return encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: 'setup',
    args: [
      owners,
      BigInt(threshold),
      '0x0000000000000000000000000000000000000000' as Address, // to (no delegate call)
      '0x' as Hex,                                             // data
      SAFE_FALLBACK_HANDLER,                                   // fallbackHandler
      '0x0000000000000000000000000000000000000000' as Address, // paymentToken
      0n,                                                      // payment
      '0x0000000000000000000000000000000000000000' as Address, // paymentReceiver
    ],
  });
}

// ─── Predict Safe CREATE2 address ───
export async function predictSafeAddress(
  owners: Address[],
  threshold: number,
  saltNonce: bigint,
  chainId: number = 1514,
): Promise<Address> {
  const chain = chainId === 100 ? gnosis : storyL1;
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  const initializer = encodeSafeSetup(owners, threshold);

  // Get proxy creation code from factory
  const proxyCreationCode = await client.readContract({
    address: SAFE_PROXY_FACTORY,
    abi: PROXY_FACTORY_ABI,
    functionName: 'proxyCreationCode',
  }) as Hex;

  // Salt = keccak256(keccak256(initializer) + saltNonce)
  const initializerHash = keccak256(initializer);
  const salt = keccak256(
    encodePacked(
      ['bytes32', 'uint256'],
      [initializerHash, saltNonce]
    )
  );

  // initCode = proxyCreationCode + pad(singleton, 32)
  const initCode = concat([
    proxyCreationCode,
    pad(SAFE_SINGLETON, { size: 32 }),
  ]);

  const initCodeHash = keccak256(initCode);

  // CREATE2: address = keccak256(0xff + factory + salt + initCodeHash)[12:]
  const address = getContractAddress({
    bytecode: initCode,
    from: SAFE_PROXY_FACTORY,
    salt,
    opcode: 'CREATE2',
  });

  return address;
}

// ─── Find the saltNonce that produces the Gnosis Safe address ───
export async function findSaltNonce(
  safeAddress: Address,
  owners: Address[],
  threshold: number,
  maxAttempts: number = 100,
): Promise<bigint> {
  for (let i = 0; i < maxAttempts; i++) {
    const nonce = BigInt(i);
    const predicted = await predictSafeAddress(owners, threshold, nonce, 100);
    if (predicted.toLowerCase() === safeAddress.toLowerCase()) {
      return nonce;
    }
  }
  throw new Error(
    `Could not find saltNonce for Safe ${safeAddress} within ${maxAttempts} attempts. ` +
    `The Safe may have been deployed with a custom salt or different factory version.`
  );
}

// ─── Check if Safe is already deployed on Story L1 ───
export async function isSafeDeployedOnStory(address: Address): Promise<boolean> {
  const client = createPublicClient({
    chain: storyL1,
    transport: http(),
  });
  const code = await client.getCode({ address });
  return !!code && code !== '0x';
}

// ─── Deploy Safe to Story L1 with same address ───
export async function deploySafeToStory(
  gnosisSafeAddress: Address,
  privateKey?: string,
): Promise<CrossChainDeployResult> {
  // 1. Read Safe config from Gnosis
  const config = await readGnosisSafeConfig(gnosisSafeAddress);

  // 2. Find the saltNonce that produces the same address
  const saltNonce = await findSaltNonce(gnosisSafeAddress, config.owners, config.threshold);

  // 3. Predict address on Story L1
  const storyPredicted = await predictSafeAddress(config.owners, config.threshold, saltNonce, 1514);

  // 4. Verify prediction matches
  if (storyPredicted.toLowerCase() !== gnosisSafeAddress.toLowerCase()) {
    throw new Error(
      `Address mismatch! Gnosis: ${gnosisSafeAddress}, Story predicted: ${storyPredicted}. ` +
      `Safe factories may differ between chains.`
    );
  }

  // 5. Check if already deployed
  const alreadyDeployed = await isSafeDeployedOnStory(storyPredicted);
  if (alreadyDeployed) {
    return {
      gnosisSafeAddress,
      storyPredictedAddress: storyPredicted,
      storyDeployedAddress: storyPredicted,
      txHash: '0x0' as Hex,
      matched: true,
      owners: config.owners,
      threshold: config.threshold,
    };
  }

  // 6. Deploy on Story L1
  const pk = privateKey || process.env.PRIVATE_KEY;
  if (!pk) throw new Error('Missing PRIVATE_KEY env var for Story L1 deployment');

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);

  const walletClient = createWalletClient({
    chain: storyL1,
    transport: http(),
    account,
  });

  const publicClient = createPublicClient({
    chain: storyL1,
    transport: http(),
  });

  const initializer = encodeSafeSetup(config.owners, config.threshold);

  const txHash = await walletClient.writeContract({
    address: SAFE_PROXY_FACTORY,
    abi: PROXY_FACTORY_ABI,
    functionName: 'createProxyWithNonce',
    args: [SAFE_SINGLETON, initializer, saltNonce],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // 7. Verify deployment
  const deployed = await isSafeDeployedOnStory(storyPredicted);

  return {
    gnosisSafeAddress,
    storyPredictedAddress: storyPredicted,
    storyDeployedAddress: storyPredicted,
    txHash,
    matched: deployed && storyPredicted.toLowerCase() === gnosisSafeAddress.toLowerCase(),
    owners: config.owners,
    threshold: config.threshold,
  };
}

// ─── Execute a transaction through the Safe on Story L1 ───
// This is for the treasury/deployer to call IP Asset Registry via the Safe
export async function execSafeTransaction(
  safeAddress: Address,
  to: Address,
  data: Hex,
  value: bigint = 0n,
  privateKey?: string,
): Promise<Hex> {
  const pk = privateKey || process.env.PRIVATE_KEY;
  if (!pk) throw new Error('Missing PRIVATE_KEY env var');

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);

  const walletClient = createWalletClient({
    chain: storyL1,
    transport: http(),
    account,
  });

  const publicClient = createPublicClient({
    chain: storyL1,
    transport: http(),
  });

  // For a 1-of-1 Safe (treasury), we can use execTransaction directly
  // with a pre-approved signature (r=owner, s=0, v=1)
  const EXEC_TX_ABI = [{
    name: 'execTransaction',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  }] as const;

  // Pre-approved signature for owner: r=owner address padded, s=0, v=1
  const ownerPadded = pad(account.address, { size: 32 });
  const signatures = concat([
    ownerPadded,
    pad('0x0' as Hex, { size: 32 }),
    '0x01' as Hex,
  ]);

  // First approve the hash
  const nonce = await publicClient.readContract({
    address: safeAddress,
    abi: SAFE_INFO_ABI,
    functionName: 'nonce',
  });

  const txHash = await walletClient.writeContract({
    address: safeAddress,
    abi: EXEC_TX_ABI,
    functionName: 'execTransaction',
    args: [
      to,
      value,
      data,
      0, // CALL operation
      0n,
      0n,
      0n,
      '0x0000000000000000000000000000000000000000' as Address,
      '0x0000000000000000000000000000000000000000' as Address,
      signatures,
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ─── Register IP Asset via Safe on Story L1 ───
export async function registerIPAssetViaSafe(
  safeAddress: Address,
  tokenContract: Address,
  tokenId: bigint,
  privateKey?: string,
): Promise<{ txHash: Hex; ipId: Address }> {
  const IP_ASSET_REGISTRY = '0x77319B4031e6eF1250907aa00018B8B1c67a244b' as Address;

  const data = encodeFunctionData({
    abi: [{
      name: 'register',
      type: 'function',
      inputs: [
        { name: 'chainId', type: 'uint256' },
        { name: 'tokenContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [{ name: 'ipId', type: 'address' }],
    }],
    functionName: 'register',
    args: [BigInt(storyL1.id), tokenContract, tokenId],
  });

  const txHash = await execSafeTransaction(safeAddress, IP_ASSET_REGISTRY, data, 0n, privateKey);

  // Compute deterministic IP Account address
  // ipId = keccak256(chainId, tokenContract, tokenId) — simplified
  // In practice, read from the registry after tx
  const publicClient = createPublicClient({
    chain: storyL1,
    transport: http(),
  });

  const ipId = await publicClient.readContract({
    address: IP_ASSET_REGISTRY,
    abi: [{
      name: 'ipId',
      type: 'function',
      inputs: [
        { name: 'chainId', type: 'uint256' },
        { name: 'tokenContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'address' }],
    }],
    functionName: 'ipId',
    args: [BigInt(storyL1.id), tokenContract, tokenId],
  }) as Address;

  return { txHash, ipId };
}
