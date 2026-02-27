/// One-shot script: Deploy Gnosis Safe to Optimism + Register Farcaster FID + Add Signer
/// Usage: npx tsx script/deploy-safe-optimism.ts
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
/// All four contracts verified on Optimism (chainId 10) ✅
///
/// After Safe deployment, this script:
///   1. Registers a Farcaster FID via IdGateway (Safe owns the FID)
///   2. Generates an Ed25519 signer keypair
///   3. Registers the signer via KeyGateway
///   4. Outputs the signer private key for wrangler secret put

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  type Hex,
  type Address,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as crypto from 'crypto';

// ─── Safe v1.4.1 (actual contracts used to deploy the Gnosis Safe) ───
const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as Address;
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address;

// ─── Target Safe ───
const GNOSIS_SAFE = '0xb7e493e3d226f8fe722cc9916ff164b793af13f4' as Address;

// ─── The EXACT setupData from the original Gnosis deployment ───
const ORIGINAL_SETUP_DATA = '0xb63e800d00000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000bd89a1ce4dde368ffab0ec35506eece0b1ffdc540000000000000000000000000000000000000000000000000000000000000160000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005afe7a11e700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000f251ca37a80200f7afeff398da0338f4c1f012490000000000000000000000001c63c3d9d211641e15cd3af46de76b4bc84cc3820000000000000000000000000000000000000000000000000000000000000024fe51f64300000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c76200000000000000000000000000000000000000000000000000000000' as Hex;

const SALT_NONCE = BigInt(0);

// ─── Farcaster Contract Addresses (Optimism) ───
const ID_GATEWAY = '0x00000000Fc25870c6eD6b6c7E41Fb078b7656f69' as Address;
const ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as Address;
const KEY_GATEWAY = '0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B' as Address;

// ─── ABIs ───
const PROXY_FACTORY_ABI = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
]);

const ID_GATEWAY_ABI = parseAbi([
  'function price() view returns (uint256)',
  'function register(address recovery) payable returns (uint256 fid)',
  'function registerFor(address to, address recovery, uint256 deadline, bytes sig) payable returns (uint256 fid)',
  'function nonces(address) view returns (uint256)',
]);

const ID_REGISTRY_ABI = parseAbi([
  'function idOf(address) view returns (uint256)',
]);

const KEY_GATEWAY_ABI = parseAbi([
  'function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata) external',
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint8 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
  'function nonces(address) view returns (uint256)',
]);

const SAFE_ABI = parseAbi([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
]);

// ─── Ed25519 key generation (using Node.js crypto) ───
function generateEd25519Keypair(): { privateKey: Buffer; publicKey: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  return { privateKey: Buffer.from(privRaw), publicKey: Buffer.from(pubRaw) };
}

// ─── Execute a transaction through the Safe (1-of-1 owner signature) ───
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
    args: [
      to, value, data,
      0,    // operation: Call
      0n,   // safeTxGas
      0n,   // baseGas
      0n,   // gasPrice
      '0x0000000000000000000000000000000000000000' as Address, // gasToken
      '0x0000000000000000000000000000000000000000' as Address, // refundReceiver
      nonce,
    ],
  });

  // Sign with the deployer (who is a Safe owner)
  const signature = await account.signMessage({ message: { raw: txHash as Hex } });

  // Adjust v value for Safe's signature scheme (v += 4 for eth_sign)
  const sigBytes = Buffer.from(signature.slice(2), 'hex');
  const v = sigBytes[64];
  sigBytes[64] = v + 4; // eth_sign adjustment
  const adjustedSig = `0x${sigBytes.toString('hex')}` as Hex;

  const hash = await walletClient.writeContract({
    address: GNOSIS_SAFE,
    abi: SAFE_ABI,
    functionName: 'execTransaction',
    args: [
      to, value, data,
      0,    // operation
      0n,   // safeTxGas
      0n,   // baseGas
      0n,   // gasPrice
      '0x0000000000000000000000000000000000000000' as Address,
      '0x0000000000000000000000000000000000000000' as Address,
      adjustedSig,
    ],
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

  // ─── Step 0: Check balance ───
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer ETH balance: ${Number(balance) / 1e18} ETH`);
  if (balance === 0n) {
    console.error('❌ Deployer has no ETH on Optimism. Please fund 0x1c63... with ~0.005 ETH');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Deploy Safe to Optimism
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 1: Deploy Safe to Optimism ═══');

  const existingCode = await publicClient.getCode({ address: GNOSIS_SAFE });
  if (existingCode && existingCode !== '0x') {
    console.log(`✅ Safe already deployed on Optimism at ${GNOSIS_SAFE}`);
  } else {
    console.log('Safe not yet deployed on Optimism. Deploying...');
    const txHash = await walletClient.writeContract({
      address: SAFE_PROXY_FACTORY,
      abi: PROXY_FACTORY_ABI,
      functionName: 'createProxyWithNonce',
      args: [SAFE_SINGLETON, ORIGINAL_SETUP_DATA, SALT_NONCE],
    });
    console.log(`TX submitted: ${txHash}`);
    console.log(`Explorer: https://optimistic.etherscan.io/tx/${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Status: ${receipt.status}`);

    const deployedCode = await publicClient.getCode({ address: GNOSIS_SAFE });
    if (deployedCode && deployedCode !== '0x') {
      console.log(`✅ Safe deployed at ${GNOSIS_SAFE} on Optimism`);
    } else {
      console.error(`❌ Safe NOT found at expected address after deployment`);
      process.exit(1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Register Farcaster FID
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 2: Register Farcaster FID ═══');

  // Check if Safe already has an FID
  const existingFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
  });

  if (existingFid > 0n) {
    console.log(`✅ Safe already has FID: ${existingFid}`);
  } else {
    // Get registration price
    const price = await publicClient.readContract({
      address: ID_GATEWAY, abi: ID_GATEWAY_ABI, functionName: 'price',
    });
    console.log(`FID registration price: ${Number(price) / 1e18} ETH`);

    // We need the Safe to call IdGateway.register(recovery)
    // The recovery address will be the deployer (a Safe owner)
    const registerData = encodeFunctionData({
      abi: ID_GATEWAY_ABI,
      functionName: 'register',
      args: [account.address], // recovery = deployer
    });

    console.log('Executing FID registration via Safe...');

    // First, fund the Safe with the registration price
    const fundTx = await walletClient.sendTransaction({
      to: GNOSIS_SAFE,
      value: price + price / 10n, // +10% buffer for gas
    });
    console.log(`Funded Safe with ${Number(price + price / 10n) / 1e18} ETH: ${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });

    // Execute register() via Safe
    const registerTxHash = await execSafeTx(
      publicClient, walletClient, account,
      ID_GATEWAY,
      price,
      registerData,
    );
    console.log(`Register TX: ${registerTxHash}`);
    console.log(`Explorer: https://optimistic.etherscan.io/tx/${registerTxHash}`);

    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerTxHash });
    console.log(`Status: ${registerReceipt.status}`);

    // Read the new FID
    const newFid = await publicClient.readContract({
      address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
    });
    if (newFid > 0n) {
      console.log(`✅ FID registered: ${newFid}`);
    } else {
      console.error('❌ FID registration failed — check tx receipt');
      process.exit(1);
    }
  }

  // Re-read FID for next steps
  const fid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [GNOSIS_SAFE],
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Generate Ed25519 Signer + Register via KeyGateway
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 3: Generate & Register Farcaster Signer ═══');

  const keypair = generateEd25519Keypair();
  console.log(`Ed25519 public key:  0x${keypair.publicKey.toString('hex')}`);
  console.log(`Ed25519 private key: 0x${keypair.privateKey.toString('hex')}`);

  // KeyGateway.add(keyType=1, key=pubkey, metadataType=1, metadata=signedKeyRequest)
  // keyType 1 = EdDSA (Ed25519)
  // metadataType 1 = SignedKeyRequest
  //
  // For a self-sovereign key add (owner adding their own key), we need the Safe
  // to call KeyGateway.add() directly.
  //
  // The metadata for a SignedKeyRequest is:
  //   abi.encode(SignedKeyRequestMetadata(uint256 requestFid, address requestSigner, bytes signature, uint256 deadline))
  //
  // The signature is an EIP-712 SignedKeyRequest(uint256 requestFid, bytes key, uint256 deadline)
  // signed by the requestSigner (who must own the requestFid).
  //
  // Since the Safe owns the FID, the Safe must sign this — but Safes can't do EIP-712 natively.
  // Instead, we use the deployer (EOA owner) to sign the SignedKeyRequest as the "app",
  // and register the deployer's FID as the request signer.
  //
  // Actually, for the simplest approach: the deployer (who is an owner of the Safe)
  // calls addFor() on behalf of the Safe. This requires:
  //   1. A SignedKeyRequest metadata with requestFid = deployer's fid (if any) or fid of the Safe
  //   2. An Add signature from the Safe
  //
  // The cleanest path: Safe calls KeyGateway.add() directly.
  // For add(), the caller must own an FID — the Safe does.
  // Metadata for keyType=1 (EdDSA) requires metadataType=1 (SignedKeyRequestValidator).
  //
  // Let's use the Signed Key Request approach properly:
  // The metadata encodes: (requestFid, requestSigner, signature, deadline)
  // where requestSigner signed an EIP-712 message: SignedKeyRequest(uint256 requestFid, bytes key, uint256 deadline)
  //
  // The requestSigner can be ANY address that owns the requestFid.
  // Since Safe owns fid, we need Safe to sign — but Safe can't do EIP-712 cleanly.
  //
  // Alternative: The deployer can be the "app signer" via a Signed Key Request.
  // But the deployer needs to own an FID for that.
  //
  // Simplest approach: Use addFor() where:
  //   - fidOwner = Safe address
  //   - The Safe provides an EIP-712 "Add" signature (we simulate via execTransaction)
  //
  // Actually, the absolute simplest: Safe calls add() through execTransaction.
  // The KeyGateway.add() checks msg.sender's FID via IdRegistry.
  // Metadata for a "self-add" can use metadataType=0 (none) if supported...
  //
  // After research: metadataType MUST be 1 for keyType 1.
  // The SignedKeyRequest validator requires a valid EIP-712 sig from an address that owns an FID.
  //
  // Plan: Register an FID for the deployer too (cheap), then use deployer to sign
  // the SignedKeyRequest metadata for the Safe's key.

  // Check if deployer has an FID (needed to sign the key request)
  const deployerFid = await publicClient.readContract({
    address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
  });

  let appFid = deployerFid;
  if (deployerFid === 0n) {
    console.log('Deployer needs an FID to sign the key request. Registering...');
    const price = await publicClient.readContract({
      address: ID_GATEWAY, abi: ID_GATEWAY_ABI, functionName: 'price',
    });
    const regTx = await walletClient.writeContract({
      address: ID_GATEWAY,
      abi: ID_GATEWAY_ABI,
      functionName: 'register',
      args: [account.address],
      value: price,
    });
    console.log(`Deployer FID registration TX: ${regTx}`);
    await publicClient.waitForTransactionReceipt({ hash: regTx });
    appFid = await publicClient.readContract({
      address: ID_REGISTRY, abi: ID_REGISTRY_ABI, functionName: 'idOf', args: [account.address],
    });
    console.log(`✅ Deployer FID: ${appFid}`);
  } else {
    console.log(`Deployer already has FID: ${deployerFid}`);
  }

  // Sign the SignedKeyRequest EIP-712 message
  // Domain: { name: "Farcaster SignedKeyRequestValidator", version: "1", chainId: 10, verifyingContract: 0x00000000FC700472606ED4fA22623Acf62c60553 }
  const SIGNED_KEY_REQUEST_VALIDATOR = '0x00000000FC700472606ED4fA22623Acf62c60553' as Address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours

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
      key: `0x${keypair.publicKey.toString('hex')}` as Hex,
      deadline,
    },
  });

  console.log('SignedKeyRequest signature created');

  // Encode the metadata: abi.encode(SignedKeyRequestMetadata)
  // struct SignedKeyRequestMetadata { uint256 requestFid; address requestSigner; bytes signature; uint256 deadline; }
  const { encodeAbiParameters, parseAbiParameters } = await import('viem');
  const metadata = encodeAbiParameters(
    parseAbiParameters('uint256 requestFid, address requestSigner, bytes signature, uint256 deadline'),
    [appFid, account.address, signedKeyRequestSig, deadline],
  );

  // Build the add() calldata for the Safe to execute
  const addKeyData = encodeFunctionData({
    abi: KEY_GATEWAY_ABI,
    functionName: 'add',
    args: [
      1,    // keyType: EdDSA
      `0x${keypair.publicKey.toString('hex')}` as Hex, // key
      1,    // metadataType: SignedKeyRequestValidator
      metadata,
    ],
  });

  console.log('Registering signer key via Safe → KeyGateway.add()...');
  const addKeyTxHash = await execSafeTx(
    publicClient, walletClient, account,
    KEY_GATEWAY,
    0n,
    addKeyData,
  );
  console.log(`Add key TX: ${addKeyTxHash}`);
  console.log(`Explorer: https://optimistic.etherscan.io/tx/${addKeyTxHash}`);

  const addKeyReceipt = await publicClient.waitForTransactionReceipt({ hash: addKeyTxHash });
  console.log(`Status: ${addKeyReceipt.status}`);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('✅ FARCASTER SOVEREIGN ACCOUNT SETUP COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`Safe (Optimism):     ${GNOSIS_SAFE}`);
  console.log(`FID:                 ${fid}`);
  console.log(`Signer public key:   0x${keypair.publicKey.toString('hex')}`);
  console.log(`Signer private key:  0x${keypair.privateKey.toString('hex')}`);
  console.log('');
  console.log('⚡ Next steps:');
  console.log(`   1. Store signer key:  wrangler secret put FARCASTER_SIGNER_KEY`);
  console.log(`      → paste: 0x${keypair.privateKey.toString('hex')}`);
  console.log(`   2. Store FID:         wrangler secret put FARCASTER_FID`);
  console.log(`      → paste: ${fid}`);
  console.log(`   3. Register username: https://warpcast.com/ or Farcaster fname server`);
  console.log(`   4. Transfer .box domain to ${GNOSIS_SAFE} on Optimism`);
}

main().catch(console.error);
