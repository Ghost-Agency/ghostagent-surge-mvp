/// Add Ed25519 signer to deployer's FID (2840732) directly — no Safe needed
/// The deployer EOA owns FID 2840732 and can call KeyGateway.add() directly
///
/// Usage: npx tsx script/add-signer-deployer.ts

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
  type Hex,
  type Address,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';

const KEY_GATEWAY = '0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B' as Address;
const SIGNED_KEY_REQUEST_VALIDATOR = '0x00000000FC700472606ED4fA22623Acf62c60553' as Address;
const ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as Address;

const KEY_GATEWAY_ABI = parseAbi([
  'function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata) external',
]);

const ID_REGISTRY_ABI = parseAbi([
  'function idOf(address) view returns (uint256)',
]);

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({ chain: optimism, transport: http() });
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account });

  // Verify deployer FID
  const deployerFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
  });
  console.log(`Deployer FID: ${deployerFid}`);
  if (deployerFid === 0n) { console.error('❌ Deployer has no FID'); process.exit(1); }

  // Generate Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pubKeyHex = `0x${Buffer.from(pubRaw).toString('hex')}` as Hex;
  const privKeyHex = `0x${Buffer.from(privRaw).toString('hex')}`;

  console.log(`\nEd25519 pub:  ${pubKeyHex}`);
  console.log(`Ed25519 priv: ${privKeyHex}`);

  // Sign the SignedKeyRequest EIP-712 (deployer signs as both app and fid owner)
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
  console.log('✅ SignedKeyRequest signature created');

  // Encode metadata
  const metadata = encodeAbiParameters(
    parseAbiParameters('uint256, address, bytes, uint256'),
    [deployerFid, account.address, keyRequestSig, deadline],
  );

  // Call KeyGateway.add() directly from deployer (msg.sender owns the FID)
  console.log('\nCalling KeyGateway.add() directly...');
  const txHash = await walletClient.writeContract({
    address: KEY_GATEWAY,
    abi: KEY_GATEWAY_ABI,
    functionName: 'add',
    args: [1, pubKeyHex, 1, metadata],
  });
  console.log(`TX: ${txHash}`);
  console.log(`Explorer: https://optimistic.etherscan.io/tx/${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Status: ${receipt.status}`);

  if (receipt.status === 'success') {
    console.log('\n═══════════════════════════════════════');
    console.log('✅ FARCASTER SIGNER REGISTERED');
    console.log('═══════════════════════════════════════');
    console.log(`Deployer FID:  ${deployerFid}`);
    console.log(`Safe FID:      2840731 (separate, for later transfer)`);
    console.log(`Pub key:       ${pubKeyHex}`);
    console.log(`Priv key:      ${privKeyHex}`);
    console.log('');
    console.log('Run these commands:');
    console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
    console.log(`  echo '${privKeyHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
    console.log(`  echo '${deployerFid}' | npx wrangler secret put FARCASTER_FID`);
  } else {
    console.error('❌ Transaction reverted');
  }
}

main().catch(console.error);
