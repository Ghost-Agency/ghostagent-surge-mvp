/// Build KeyGateway.add() calldata for Safe FID 2840731
/// Generates a fresh Ed25519 signer keypair and outputs calldata for safe-cli
/// Usage: npx tsx script/build-safe-fid-calldata.ts

import {
  encodeFunctionData, type Hex, createWalletClient, http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';
import {
  ViemLocalEip712Signer, NobleEd25519Signer,
  KEY_GATEWAY_ADDRESS, keyGatewayABI,
} from '@farcaster/hub-nodejs';
import { bytesToHex } from 'viem';

async function main() {
  const pk = process.env.PRIVATE_KEY!;
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}`);
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account });
  const appAccountKey = new ViemLocalEip712Signer(account as any);

  // The Safe FID is 2840731 — app signer (deployer FID 2840732) will sign the key request
  const deployerFid = BigInt(2840732);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

  // Generate new Ed25519 keypair for the Safe's FID
  const privBuf = crypto.randomBytes(32);
  const privateKeyBytes = new Uint8Array(privBuf.buffer, privBuf.byteOffset, privBuf.byteLength);
  const accountKey = new NobleEd25519Signer(privateKeyBytes);
  const accountKeyResult = await accountKey.getSignerKey();
  if (accountKeyResult.isErr()) { console.error('Failed to get signer key'); process.exit(1); }
  const accountPubKey = accountKeyResult.value;
  const pubHex = bytesToHex(accountPubKey);
  const privHex = bytesToHex(privateKeyBytes);

  // Sign the SignedKeyRequest metadata with the deployer's account key
  const meta = await appAccountKey.getSignedKeyRequestMetadata({
    requestFid: deployerFid,
    key: accountPubKey,
    deadline,
  });
  if (meta.isErr()) { console.error('Failed to create metadata:', meta.error); process.exit(1); }
  const metadataHex = bytesToHex(meta.value) as Hex;

  // Encode the KeyGateway.add() calldata
  const calldata = encodeFunctionData({
    abi: keyGatewayABI,
    functionName: 'add',
    args: [1, pubHex, 1, metadataHex],
  });

  console.log('\n=== SAFE FID SIGNER CALLDATA ===');
  console.log(`KEY_GATEWAY=${KEY_GATEWAY_ADDRESS}`);
  console.log(`CALLDATA=${calldata}`);
  console.log(`NEW_SIGNER_PUB=${pubHex}`);
  console.log(`NEW_SIGNER_PRIV=${privHex}`);
  console.log('');
  console.log('=== safe-cli command ===');
  console.log(`safe-cli send-custom \\`);
  console.log(`  0xb7e493e3d226f8fE722CC9916fF164B793af13F4 \\`);
  console.log(`  https://mainnet.optimism.io \\`);
  console.log(`  ${KEY_GATEWAY_ADDRESS} \\`);
  console.log(`  0 \\`);
  console.log(`  ${calldata} \\`);
  console.log(`  --private-key <PRIVATE_KEY> \\`);
  console.log(`  --non-interactive`);
}

main().catch(console.error);
