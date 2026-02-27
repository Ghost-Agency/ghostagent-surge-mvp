/// Add Ed25519 signer using @farcaster/hub-nodejs official helpers
/// Usage: npx tsx script/add-signer-official.ts

import {
  ViemLocalEip712Signer,
  NobleEd25519Signer,
  KEY_GATEWAY_ADDRESS,
  keyGatewayABI,
} from '@farcaster/hub-nodejs';
import { bytesToHex, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('Missing PRIVATE_KEY'); process.exit(1); }

  const app = privateKeyToAccount(pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}`);
  console.log(`Deployer (app): ${app.address}`);

  const appAccountKey = new ViemLocalEip712Signer(app as any);

  const publicClient = createPublicClient({ chain: optimism, transport: http() });
  const walletClient = createWalletClient({ chain: optimism, transport: http(), account: app });

  // Deployer FID
  const APP_FID = BigInt(2840732);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // 1. Generate Ed25519 key via Node crypto → Uint8Array
  const privBuf = crypto.randomBytes(32);
  const privateKeyBytes = new Uint8Array(privBuf.buffer, privBuf.byteOffset, privBuf.byteLength);
  const accountKey = new NobleEd25519Signer(privateKeyBytes);
  const accountKeyResult = await accountKey.getSignerKey();
  if (accountKeyResult.isErr()) { console.error('Failed to get signer key'); process.exit(1); }
  const accountPubKey = accountKeyResult.value;

  const pubHex = bytesToHex(accountPubKey);
  const privHex = bytesToHex(privateKeyBytes);
  console.log(`\nEd25519 pub:  ${pubHex}`);
  console.log(`Ed25519 priv: ${privHex}`);

  // 2. Create SignedKeyRequest metadata (app signs)
  const signedKeyRequestMetadata = await appAccountKey.getSignedKeyRequestMetadata({
    requestFid: APP_FID,
    key: accountPubKey,
    deadline,
  });

  if (signedKeyRequestMetadata.isErr()) {
    console.error('Failed to create SignedKeyRequest metadata:', signedKeyRequestMetadata.error);
    process.exit(1);
  }
  console.log('✅ SignedKeyRequest metadata created');

  const metadata = bytesToHex(signedKeyRequestMetadata.value);

  // 3. Since deployer is BOTH the app and the fid owner, we use add() directly
  // The deployer calls add() on the KeyGateway (msg.sender must own the FID)
  console.log('\nCalling KeyGateway.add()...');
  try {
    const { request } = await publicClient.simulateContract({
      account: app,
      address: KEY_GATEWAY_ADDRESS,
      abi: keyGatewayABI,
      functionName: 'add',
      args: [1, pubHex, 1, metadata],
    });
    const txHash = await walletClient.writeContract(request);
    console.log(`TX: ${txHash}`);
    console.log(`Explorer: https://optimistic.etherscan.io/tx/${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Status: ${receipt.status}`);

    if (receipt.status === 'success') {
      console.log('\n═══════════════════════════════════════');
      console.log('✅ FARCASTER SIGNER REGISTERED');
      console.log('═══════════════════════════════════════');
      console.log(`FID:       ${APP_FID}`);
      console.log(`Pub key:   ${pubHex}`);
      console.log(`Priv key:  ${privHex}`);
      console.log('');
      console.log('Run these commands:');
      console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
      console.log(`  echo '${privHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
      console.log(`  echo '${APP_FID}' | npx wrangler secret put FARCASTER_FID`);
    }
  } catch (e: any) {
    console.error('add() failed:', e.shortMessage || e.message);

    // Fallback: try addFor() pattern
    console.log('\nTrying addFor() pattern instead...');
    const nonce = await publicClient.readContract({
      address: KEY_GATEWAY_ADDRESS,
      abi: keyGatewayABI,
      functionName: 'nonces',
      args: [app.address],
    });

    const addSignature = await appAccountKey.signAdd({
      owner: app.address as `0x${string}`,
      keyType: 1,
      key: accountPubKey,
      metadataType: 1,
      metadata: signedKeyRequestMetadata.value,
      nonce,
      deadline,
    });

    if (addSignature.isErr()) {
      console.error('Failed to create Add signature:', addSignature.error);
      process.exit(1);
    }

    try {
      const { request } = await publicClient.simulateContract({
        account: app,
        address: KEY_GATEWAY_ADDRESS,
        abi: keyGatewayABI,
        functionName: 'addFor',
        args: [
          app.address,
          1,
          pubHex,
          1,
          metadata,
          deadline,
          bytesToHex(addSignature.value),
        ],
      });
      const txHash = await walletClient.writeContract(request);
      console.log(`TX: ${txHash}`);
      console.log(`Explorer: https://optimistic.etherscan.io/tx/${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`Status: ${receipt.status}`);

      if (receipt.status === 'success') {
        console.log('\n═══════════════════════════════════════');
        console.log('✅ FARCASTER SIGNER REGISTERED (via addFor)');
        console.log('═══════════════════════════════════════');
        console.log(`FID:       ${APP_FID}`);
        console.log(`Pub key:   ${pubHex}`);
        console.log(`Priv key:  ${privHex}`);
        console.log('');
        console.log('Run these commands:');
        console.log(`  cd /Users/richieogorman/CascadeProjects/ghostagent-proxy`);
        console.log(`  echo '${privHex}' | npx wrangler secret put FARCASTER_SIGNER_KEY`);
        console.log(`  echo '${APP_FID}' | npx wrangler secret put FARCASTER_FID`);
      }
    } catch (e2: any) {
      console.error('addFor() also failed:', e2.shortMessage || e2.message);
      console.log(`\nKeypair (save these — not registered yet):`);
      console.log(`  Pub:  ${pubHex}`);
      console.log(`  Priv: ${privHex}`);
    }
  }
}

main().catch(console.error);
