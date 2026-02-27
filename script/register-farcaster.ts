/// Register Farcaster FID for Safe + Generate & Register Ed25519 Signer
/// Usage: npx tsx script/register-farcaster.ts
///
/// Requires: PRIVATE_KEY env var (deployer 0x1c63C3... — a Safe owner)
/// Prerequisites: Safe already deployed on Optimism at 0xb7e4...

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
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';

// ─── Target Safe ───
const GNOSIS_SAFE = '0xb7e493e3d226f8fE722CC9916fF164B793af13F4' as Address;

// ─── Farcaster Contract Addresses (Optimism) ───
const ID_GATEWAY = '0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69' as Address;
const ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as Address;
const KEY_GATEWAY = '0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B' as Address;
const SIGNED_KEY_REQUEST_VALIDATOR = '0x00000000FC700472606ED4fA22623Acf62c60553' as Address;

// ─── ABIs ───
const ID_GATEWAY_ABI = parseAbi([
  'function price() view returns (uint256)',
  'function register(address recovery) payable returns (uint256 fid)',
  'function nonces(address) view returns (uint256)',
]);

const ID_REGISTRY_ABI = parseAbi([
  'function idOf(address) view returns (uint256)',
]);

const KEY_GATEWAY_ABI = parseAbi([
  'function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata) external',
  'function nonces(address) view returns (uint256)',
]);

const SAFE_ABI = parseAbi([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
]);

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

// ─── Ed25519 key generation ───
function generateEd25519Keypair(): { privateKey: Buffer; publicKey: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  return { privateKey: Buffer.from(privRaw), publicKey: Buffer.from(pubRaw) };
}

// ─── Execute tx through Safe (1-of-2 threshold, eth_sign style) ───
async function execSafeTx(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  to: Address,
  value: bigint,
  data: Hex,
) {
  const nonce = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'nonce',
  });

  const txHash = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getTransactionHash',
    args: [to, value, data, 0, 0n, 0n, 0n, ZERO, ZERO, nonce],
  });

  const signature = await account.signMessage({ message: { raw: txHash as Hex } });

  // Adjust v for Safe eth_sign (v += 4)
  const sigBytes = Buffer.from(signature.slice(2), 'hex');
  sigBytes[64] = sigBytes[64] + 4;
  const adjustedSig = `0x${sigBytes.toString('hex')}` as Hex;

  const hash = await walletClient.writeContract({
    address: GNOSIS_SAFE,
    abi: SAFE_ABI,
    functionName: 'execTransaction',
    args: [to, value, data, 0, 0n, 0n, 0n, ZERO, ZERO, adjustedSig],
  });

  return hash;
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY env var'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({ chain: optimism, transport: http() });
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account });

  // ─── Verify Safe exists ───
  const code = await publicClient.getCode({ address: GNOSIS_SAFE });
  if (!code || code === '0x') {
    console.error('❌ Safe not deployed on Optimism yet');
    process.exit(1);
  }
  console.log('✅ Safe confirmed on Optimism');

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer balance: ${Number(balance) / 1e18} ETH`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Register Farcaster FID
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 2: Register Farcaster FID ═══');

  let fid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
  });

  if (fid > 0n) {
    console.log(`✅ Safe already has FID: ${fid}`);
  } else {
    const price = await publicClient.readContract({
      address: ID_GATEWAY, abi: ID_GATEWAY_ABI, functionName: 'price',
    });
    console.log(`FID registration price: ${Number(price) / 1e18} ETH`);

    // Fund the Safe with enough ETH for the registration
    const fundAmount = price + price / 5n; // +20% buffer
    console.log(`Funding Safe with ${Number(fundAmount) / 1e18} ETH...`);
    const fundTx = await walletClient.sendTransaction({ to: GNOSIS_SAFE, value: fundAmount });
    console.log(`Fund TX: ${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });

    // Safe calls IdGateway.register(recovery=deployer) with msg.value=price
    const registerData = encodeFunctionData({
      abi: ID_GATEWAY_ABI,
      functionName: 'register',
      args: [account.address], // recovery = deployer
    });

    console.log('Executing IdGateway.register() via Safe...');
    const registerHash = await execSafeTx(publicClient, walletClient, account, ID_GATEWAY, price, registerData);
    console.log(`Register TX: ${registerHash}`);
    console.log(`Explorer: https://optimistic.etherscan.io/tx/${registerHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log(`Status: ${receipt.status}`);

    fid = await publicClient.readContract({
      address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
    });
    if (fid > 0n) {
      console.log(`✅ FID registered: ${fid}`);
    } else {
      console.error('❌ FID registration failed');
      process.exit(1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Generate Ed25519 Signer + Register via KeyGateway
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 3: Generate & Register Farcaster Signer ═══');

  const keypair = generateEd25519Keypair();
  const pubKeyHex = `0x${keypair.publicKey.toString('hex')}` as Hex;
  const privKeyHex = `0x${keypair.privateKey.toString('hex')}`;
  console.log(`Ed25519 public key:  ${pubKeyHex}`);
  console.log(`Ed25519 private key: ${privKeyHex}`);

  // The deployer needs an FID to act as the "app" signing the key request.
  // If deployer has no FID, register one.
  let appFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
  });

  if (appFid === 0n) {
    console.log('Deployer needs an FID to sign key request. Registering...');
    const price = await publicClient.readContract({
      address: ID_GATEWAY, abi: ID_GATEWAY_ABI, functionName: 'price',
    });
    const regTx = await walletClient.writeContract({
      address: ID_GATEWAY, abi: ID_GATEWAY_ABI, functionName: 'register',
      args: [account.address], value: price,
    });
    console.log(`Deployer FID TX: ${regTx}`);
    await publicClient.waitForTransactionReceipt({ hash: regTx });
    appFid = await publicClient.readContract({
      address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
    });
    console.log(`✅ Deployer FID: ${appFid}`);
  } else {
    console.log(`Deployer already has FID: ${appFid}`);
  }

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
      requestFid: appFid,
      key: pubKeyHex,
      deadline,
    },
  });
  console.log('✅ SignedKeyRequest signature created');

  // Encode metadata: (uint256 requestFid, address requestSigner, bytes signature, uint256 deadline)
  const metadata = encodeAbiParameters(
    parseAbiParameters('uint256 requestFid, address requestSigner, bytes signature, uint256 deadline'),
    [appFid, account.address, signedKeyRequestSig, deadline],
  );

  // Safe calls KeyGateway.add(keyType=1, key, metadataType=1, metadata)
  const addKeyData = encodeFunctionData({
    abi: KEY_GATEWAY_ABI,
    functionName: 'add',
    args: [1, pubKeyHex, 1, metadata],
  });

  console.log('Registering signer key via Safe → KeyGateway.add()...');
  const addKeyHash = await execSafeTx(publicClient, walletClient, account, KEY_GATEWAY, 0n, addKeyData);
  console.log(`Add key TX: ${addKeyHash}`);
  console.log(`Explorer: https://optimistic.etherscan.io/tx/${addKeyHash}`);

  const addKeyReceipt = await publicClient.waitForTransactionReceipt({ hash: addKeyHash });
  console.log(`Status: ${addKeyReceipt.status}`);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('✅ FARCASTER SOVEREIGN ACCOUNT COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`Safe (Optimism):     ${GNOSIS_SAFE}`);
  console.log(`FID:                 ${fid}`);
  console.log(`Signer public key:   ${pubKeyHex}`);
  console.log(`Signer private key:  ${privKeyHex}`);
  console.log('');
  console.log('⚡ Next steps:');
  console.log('   1. Store signer key:');
  console.log(`      cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
  console.log(`      echo "${privKeyHex}" | wrangler secret put FARCASTER_SIGNER_KEY`);
  console.log(`   2. Store FID:`);
  console.log(`      echo "${fid}" | wrangler secret put FARCASTER_FID`);
  console.log(`   3. Register fname: https://fnames.farcaster.xyz`);
}

main().catch(console.error);
