/// Register Ed25519 Signer for Farcaster via Safe on Optimism
/// Usage: npx tsx script/register-farcaster-signer.ts
///
/// Requires: PRIVATE_KEY env var (deployer 0x1c63C3... — a Safe owner)
/// Prerequisites: Safe deployed on Optimism, FID already registered (2840731)

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  type Hex,
  type Address,
  parseAbi,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';

// ─── Target Safe ───
const GNOSIS_SAFE = '0xb7e493e3d226f8fE722CC9916fF164B793af13F4' as Address;

// ─── Farcaster Contract Addresses (Optimism) ───
const ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as Address;
const KEY_GATEWAY = '0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B' as Address;
const SIGNED_KEY_REQUEST_VALIDATOR = '0x00000000FC700472606ED4fA22623Acf62c60553' as Address;

// ─── ABIs ───
const ID_REGISTRY_ABI = parseAbi([
  'function idOf(address) view returns (uint256)',
]);

const KEY_GATEWAY_ABI = parseAbi([
  'function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata) external',
]);

const SAFE_ABI = parseAbi([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function approveHash(bytes32 hashToApprove) external',
  'function approvedHashes(address owner, bytes32 hash) view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
]);

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

// ─── Ed25519 key generation ───
function generateEd25519Keypair(): { privateKey: Buffer; publicKey: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  return { privateKey: Buffer.from(privRaw), publicKey: Buffer.from(pubRaw) };
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY env var'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({ chain: optimism, transport: http() });
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account });

  // Verify state
  const owners = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getOwners',
  });
  const threshold = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getThreshold',
  });
  const nonce = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'nonce',
  });
  console.log(`Owners: ${owners.join(', ')}`);
  console.log(`Threshold: ${threshold}, Nonce: ${nonce}`);

  const safeFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
  });
  console.log(`Safe FID: ${safeFid}`);

  const deployerFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
  });
  console.log(`Deployer FID: ${deployerFid}`);

  if (safeFid === 0n) { console.error('❌ Safe has no FID'); process.exit(1); }
  if (deployerFid === 0n) { console.error('❌ Deployer has no FID'); process.exit(1); }

  // Generate signer
  const keypair = generateEd25519Keypair();
  const pubKeyHex = `0x${keypair.publicKey.toString('hex')}` as Hex;
  const privKeyHex = `0x${keypair.privateKey.toString('hex')}`;
  console.log(`\nEd25519 public key:  ${pubKeyHex}`);
  console.log(`Ed25519 private key: ${privKeyHex}`);

  // Sign the SignedKeyRequest EIP-712 message (deployer signs as "app")
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

  const signedKeyRequestSig = await walletClient.signTypedData({
    account,
    domain: {
      name: 'Farcaster SignedKeyRequestValidator',
      version: '1',
      chainId: 10,
      verifyingContract: SIGNED_KEY_REQUEST_VALIDATOR,
    },
    types: {
      SignedKeyRequest: [
        { name: 'requestFid', type: 'uint256' },
        { name: 'key', type: 'bytes' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'SignedKeyRequest',
    message: {
      requestFid: deployerFid,
      key: pubKeyHex,
      deadline,
    },
  });
  console.log('✅ SignedKeyRequest signature created');

  // Encode metadata
  const metadata = encodeAbiParameters(
    parseAbiParameters('uint256 requestFid, address requestSigner, bytes signature, uint256 deadline'),
    [deployerFid, account.address, signedKeyRequestSig, deadline],
  );

  // Build add() calldata
  const addKeyData = encodeFunctionData({
    abi: KEY_GATEWAY_ABI,
    functionName: 'add',
    args: [1, pubKeyHex, 1, metadata],
  });

  // ─── Use approveHash pattern instead of eth_sign ───
  // Step 1: Get the Safe tx hash
  const safeTxHash = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getTransactionHash',
    args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, nonce],
  });
  console.log(`\nSafe TX hash: ${safeTxHash}`);

  // Step 2: Approve the hash from the deployer
  console.log('Approving hash on-chain...');
  const approveTx = await walletClient.writeContract({
    address: GNOSIS_SAFE,
    abi: SAFE_ABI,
    functionName: 'approveHash',
    args: [safeTxHash],
  });
  console.log(`Approve TX: ${approveTx}`);
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log('✅ Hash approved');

  // Step 3: Execute with pre-approved signature (r=owner, s=0, v=1)
  // For approved hash signatures: r = owner address, s = 0, v = 1
  const ownerPadded = account.address.toLowerCase().slice(2).padStart(64, '0');
  const approvedSig = `0x${ownerPadded}${'0'.repeat(64)}01` as Hex;

  console.log('Executing KeyGateway.add() via Safe...');
  const execHash = await walletClient.writeContract({
    address: GNOSIS_SAFE,
    abi: SAFE_ABI,
    functionName: 'execTransaction',
    args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, approvedSig],
  });
  console.log(`Exec TX: ${execHash}`);
  console.log(`Explorer: https://optimistic.etherscan.io/tx/${execHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: execHash });
  console.log(`Status: ${receipt.status}`);

  if (receipt.status === 'success') {
    console.log('\n═══════════════════════════════════════');
    console.log('✅ FARCASTER SIGNER REGISTERED');
    console.log('═══════════════════════════════════════');
    console.log(`Safe FID:            ${safeFid}`);
    console.log(`Signer public key:   ${pubKeyHex}`);
    console.log(`Signer private key:  ${privKeyHex}`);
    console.log('');
    console.log('⚡ Next steps:');
    console.log(`   cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
    console.log(`   echo "${privKeyHex}" | wrangler secret put FARCASTER_SIGNER_KEY`);
    console.log(`   echo "${safeFid}" | wrangler secret put FARCASTER_FID`);
  } else {
    console.error('❌ Transaction reverted');
  }
}

main().catch(console.error);
