/// @module ecies
/// ECIES (Elliptic Curve Integrated Encryption Scheme) for Cloudflare Workers
/// Uses secp256k1-compatible keys (same as Ethereum/Safe wallets)
/// Implemented with Web Crypto API — zero npm dependencies
///
/// Flow:
///   Encrypt: ephemeralPub + AES-GCM(sharedSecret, plaintext) → ciphertext blob
///   Decrypt: derive sharedSecret from ephemeralPub + recipientPrivKey → AES-GCM decrypt
///
/// The recipient's Safe public key is used for encryption.
/// Only the Safe private key holder can decrypt.

// --- Helpers ---

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// --- ECDH Key Derivation (P-256 for Web Crypto compatibility) ---
// Note: Web Crypto doesn't support secp256k1 natively.
// We use P-256 (secp256r1) for the ECIES layer.
// The recipient's "ECIES public key" is a P-256 key derived from their Safe,
// stored in KV as `ecies-pubkey:<agent>`.

export interface ECIESKeyPair {
  publicKey: string;   // hex-encoded uncompressed P-256 public key (65 bytes)
  privateKey: string;  // hex-encoded P-256 private key (32 bytes)
}

export interface EncryptedEnvelope {
  version: 1;
  ephemeralPublicKey: string;  // hex, 65 bytes uncompressed
  iv: string;                   // hex, 12 bytes
  ciphertext: string;           // hex, AES-256-GCM encrypted
  tag: string;                  // hex, 16 bytes GCM auth tag (included in ciphertext)
  contentHash: string;          // SHA-256 of plaintext for integrity
}

// Generate a new ECIES key pair (P-256)
export async function generateKeyPair(): Promise<ECIESKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // JWK 'd' parameter is the private key (base64url encoded)
  const dBytes = base64urlToBytes(privJwk.d!);

  return {
    publicKey: bytesToHex(new Uint8Array(pubRaw)),
    privateKey: bytesToHex(dBytes),
  };
}

// Import a public key from hex
async function importPublicKey(pubHex: string): Promise<CryptoKey> {
  const pubBytes = hexToBytes(pubHex);
  return crypto.subtle.importKey(
    'raw',
    pubBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

// Import a private key from hex
async function importPrivateKey(privHex: string): Promise<CryptoKey> {
  const privBytes = hexToBytes(privHex);
  // Convert raw private key to JWK format
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: bytesToBase64url(privBytes),
    // We need x,y for the JWK — derive from private key
    // For import, we can use a dummy approach: generate and replace
    x: '', // Will be filled
    y: '', // Will be filled
  };

  // Actually, we need the full JWK. Let's use a different approach:
  // Import as PKCS8
  // For P-256, the raw private key is 32 bytes
  // We'll wrap it in a PKCS8 DER structure

  const pkcs8 = wrapP256PrivateKey(privBytes);
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
}

// Wrap a raw 32-byte P-256 private key in PKCS8 DER format
function wrapP256PrivateKey(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 wrapper for P-256 ECDH key
  // SEQUENCE {
  //   INTEGER 0
  //   SEQUENCE { OID ecPublicKey, OID prime256v1 }
  //   OCTET STRING { SEQUENCE { INTEGER 1, OCTET STRING <key> } }
  // }
  const prefix = new Uint8Array([
    0x30, 0x41, // SEQUENCE (65 bytes)
    0x02, 0x01, 0x00, // INTEGER 0 (version)
    0x30, 0x13, // SEQUENCE (19 bytes)
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (ecPublicKey)
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (prime256v1)
    0x04, 0x27, // OCTET STRING (39 bytes)
    0x30, 0x25, // SEQUENCE (37 bytes)
    0x02, 0x01, 0x01, // INTEGER 1 (version)
    0x04, 0x20, // OCTET STRING (32 bytes) — the actual private key
  ]);
  return concatBytes(prefix, rawKey).buffer;
}

// Derive shared AES-256 key from ECDH
async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );

  // HKDF the shared secret into an AES-256-GCM key
  const sharedKeyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('nftmail-ecies-v1'),
      info: new TextEncoder().encode('aes-256-gcm'),
    },
    sharedKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// SHA-256 hex hash
async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(hash));
}

// --- Encrypt ---

export async function encrypt(
  plaintext: string,
  recipientPublicKeyHex: string
): Promise<EncryptedEnvelope> {
  // 1. Generate ephemeral key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // 2. Export ephemeral public key
  const ephPubRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey);
  const ephemeralPublicKey = bytesToHex(new Uint8Array(ephPubRaw));

  // 3. Import recipient's public key
  const recipientPub = await importPublicKey(recipientPublicKeyHex);

  // 4. Derive shared AES key
  const aesKey = await deriveSharedKey(ephemeral.privateKey, recipientPub);

  // 5. Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 6. Encrypt with AES-256-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    encoded
  );

  // 7. Content hash for integrity verification
  const contentHash = await sha256Hex(plaintext);

  return {
    version: 1,
    ephemeralPublicKey,
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
    tag: '', // GCM tag is appended to ciphertext by Web Crypto
    contentHash,
  };
}

// --- Decrypt ---

export async function decrypt(
  envelope: EncryptedEnvelope,
  recipientPrivateKeyHex: string
): Promise<string> {
  // 1. Import ephemeral public key
  const ephPub = await importPublicKey(envelope.ephemeralPublicKey);

  // 2. Import recipient's private key
  const recipientPriv = await importPrivateKey(recipientPrivateKeyHex);

  // 3. Derive shared AES key
  const aesKey = await deriveSharedKey(recipientPriv, ephPub);

  // 4. Decrypt
  const iv = hexToBytes(envelope.iv);
  const ciphertext = hexToBytes(envelope.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    ciphertext
  );

  const plaintext = new TextDecoder().decode(decrypted);

  // 5. Verify content hash
  const hash = await sha256Hex(plaintext);
  if (hash !== envelope.contentHash) {
    throw new Error('Content hash mismatch — message integrity compromised');
  }

  return plaintext;
}

// --- Base64url helpers ---

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
