/// Register Ed25519 Signer for Farcaster via Safe on Optimism
/// Safe FID: 2840731, Deployer FID: 2840732
/// Uses eth_sign signature with v+4 adjustment
///
/// Usage: npx tsx script/register-signer-only.ts

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

const GNOSIS_SAFE = '0xb7e493e3d226f8fE722CC9916fF164B793af13F4' as Address;
const KEY_GATEWAY = '0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B' as Address;
const SIGNED_KEY_REQUEST_VALIDATOR = '0x00000000FC700472606ED4fA22623Acf62c60553' as Address;
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

const SAFE_ABI = parseAbi([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function getOwners() view returns (address[])',
]);

const KEY_GATEWAY_ABI = parseAbi([
  'function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata) external',
]);

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({ chain: optimism, transport: http() });
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account });

  // Check owners
  const owners = await publicClient.readContract({ address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getOwners' });
  console.log(`Owners: ${owners.join(', ')}`);

  const isOwner = owners.some(o => o.toLowerCase() === account.address.toLowerCase());
  if (!isOwner) { console.error('❌ Deployer is not a Safe owner!'); process.exit(1); }

  // Generate Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pubKeyHex = `0x${Buffer.from(pubRaw).toString('hex')}` as Hex;
  const privKeyHex = `0x${Buffer.from(privRaw).toString('hex')}`;

  console.log(`\nEd25519 pub:  ${pubKeyHex}`);
  console.log(`Ed25519 priv: ${privKeyHex}`);

  // Build SignedKeyRequest metadata
  const deployerFid = 2840732n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

  const keyRequestSig = await walletClient.signTypedData({
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
    message: { requestFid: deployerFid, key: pubKeyHex, deadline },
  });
  console.log('✅ SignedKeyRequest sig created');

  const metadata = encodeAbiParameters(
    parseAbiParameters('uint256, address, bytes, uint256'),
    [deployerFid, account.address, keyRequestSig, deadline],
  );

  const addKeyData = encodeFunctionData({
    abi: KEY_GATEWAY_ABI,
    functionName: 'add',
    args: [1, pubKeyHex, 1, metadata],
  });

  // Get Safe nonce and compute tx hash
  const nonce = await publicClient.readContract({ address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'nonce' });
  console.log(`Safe nonce: ${nonce}`);

  const safeTxHash = await publicClient.readContract({
    address: GNOSIS_SAFE, abi: SAFE_ABI, functionName: 'getTransactionHash',
    args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, nonce],
  });
  console.log(`Safe TX hash: ${safeTxHash}`);

  // Sign with signMessage (eth_sign) — this adds the "\x19Ethereum Signed Message:\n32" prefix
  const rawSig = await account.signMessage({ message: { raw: safeTxHash as Hex } });
  console.log(`Raw sig v: ${parseInt(rawSig.slice(-2), 16)}`);

  // For Safe: eth_sign signatures use v += 4
  const sigBytes = Buffer.from(rawSig.slice(2), 'hex');
  const origV = sigBytes[64];
  sigBytes[64] = origV + 4;
  const safeSig = `0x${sigBytes.toString('hex')}` as Hex;
  console.log(`Adjusted sig v: ${sigBytes[64]}`);

  // Execute
  console.log('\nExecuting KeyGateway.add() via Safe...');
  try {
    const txHash = await walletClient.writeContract({
      address: GNOSIS_SAFE,
      abi: SAFE_ABI,
      functionName: 'execTransaction',
      args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, safeSig],
    });
    console.log(`TX: ${txHash}`);
    console.log(`Explorer: https://optimistic.etherscan.io/tx/${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Status: ${receipt.status}`);

    if (receipt.status === 'success') {
      console.log('\n═══════════════════════════════════════');
      console.log('✅ FARCASTER SIGNER REGISTERED');
      console.log('═══════════════════════════════════════');
      console.log(`Safe FID:   2840731`);
      console.log(`Pub key:    ${pubKeyHex}`);
      console.log(`Priv key:   ${privKeyHex}`);
      console.log('');
      console.log('Run these commands:');
      console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
      console.log(`  echo '${privKeyHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
      console.log(`  echo '2840731' | npx wrangler secret put FARCASTER_FID`);
    }
  } catch (e: any) {
    console.error(`\n❌ execTransaction failed: ${e.shortMessage || e.message}`);

    // Fallback: try without v adjustment (standard ECDSA v=27/28)
    console.log('\nRetrying with standard v (no +4)...');
    const sigBytes2 = Buffer.from(rawSig.slice(2), 'hex');
    const safeSig2 = `0x${sigBytes2.toString('hex')}` as Hex;

    try {
      const txHash2 = await walletClient.writeContract({
        address: GNOSIS_SAFE,
        abi: SAFE_ABI,
        functionName: 'execTransaction',
        args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, safeSig2],
      });
      console.log(`TX: ${txHash2}`);
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: txHash2 });
      console.log(`Status: ${receipt2.status}`);

      if (receipt2.status === 'success') {
        console.log('\n═══════════════════════════════════════');
        console.log('✅ FARCASTER SIGNER REGISTERED (v=standard)');
        console.log('═══════════════════════════════════════');
        console.log(`Safe FID:   2840731`);
        console.log(`Pub key:    ${pubKeyHex}`);
        console.log(`Priv key:   ${privKeyHex}`);
        console.log('');
        console.log('Run these commands:');
        console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
        console.log(`  echo '${privKeyHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
        console.log(`  echo '2840731' | npx wrangler secret put FARCASTER_FID`);
      }
    } catch (e2: any) {
      console.error(`Also failed: ${e2.shortMessage || e2.message}`);

      // Last resort: try EIP-1271 / contract sig approach
      // For 1-of-N threshold Safes, use pre-validated signature: r=owner_addr padded, s=0, v=1
      console.log('\nRetrying with pre-validated signature (v=1)...');
      const ownerPadded = account.address.toLowerCase().slice(2).padStart(64, '0');
      const preValidatedSig = `0x${ownerPadded}${'0'.repeat(64)}01` as Hex;

      try {
        const txHash3 = await walletClient.writeContract({
          address: GNOSIS_SAFE,
          abi: SAFE_ABI,
          functionName: 'execTransaction',
          args: [KEY_GATEWAY, 0n, addKeyData, 0, 0n, 0n, 0n, ZERO, ZERO, preValidatedSig],
        });
        console.log(`TX: ${txHash3}`);
        const receipt3 = await publicClient.waitForTransactionReceipt({ hash: txHash3 });
        console.log(`Status: ${receipt3.status}`);

        if (receipt3.status === 'success') {
          console.log('\n═══════════════════════════════════════');
          console.log('✅ FARCASTER SIGNER REGISTERED (pre-validated)');
          console.log('═══════════════════════════════════════');
          console.log(`Safe FID:   2840731`);
          console.log(`Pub key:    ${pubKeyHex}`);
          console.log(`Priv key:   ${privKeyHex}`);
          console.log('');
          console.log('Run these commands:');
          console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
          console.log(`  echo '${privKeyHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
          console.log(`  echo '2840731' | npx wrangler secret put FARCASTER_FID`);
        }
      } catch (e3: any) {
        console.error(`All approaches failed: ${e3.shortMessage || e3.message}`);
        console.log('\nThe ed25519 keypair was generated but NOT registered on-chain.');
        console.log(`Pub:  ${pubKeyHex}`);
        console.log(`Priv: ${privKeyHex}`);
      }
    }
  }
}

main().catch(console.error);
