/// Browser-side ECIES decrypt — identical algorithm to workers/nftmail-email-worker/src/ecies.ts
/// Uses P-256 (secp256r1) + ECDH + HKDF + AES-256-GCM via Web Crypto API.
/// No npm dependencies — works in any modern browser or Next.js client component.
///
/// The recipient's private key (32-byte hex P-256 scalar) is the ECIES decryption key.
/// It was returned once by generateEciesKeyPair and must be stored by the user.

export interface EncryptedEnvelope {
  version: 1;
  ephemeralPublicKey: string; // hex, 65 bytes uncompressed P-256
  iv: string;                  // hex, 12 bytes
  ciphertext: string;          // hex, AES-256-GCM ciphertext + 16-byte GCM tag
  tag: string;
  contentHash: string;         // SHA-256 hex of plaintext
}

// ─── Helpers ───

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

// ─── Key import ───

async function importPublicKey(pubHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(pubHex).buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

function wrapP256PrivateKey(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 DER wrapper for a raw 32-byte P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x41,
    0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27,
    0x30, 0x25,
    0x02, 0x01, 0x01,
    0x04, 0x20,
  ]);
  const merged = concatBytes(prefix, rawKey);
  return merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength) as ArrayBuffer;
}

async function importPrivateKey(privHex: string): Promise<CryptoKey> {
  const privBytes = hexToBytes(privHex);
  const pkcs8 = wrapP256PrivateKey(privBytes);
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
}

// ─── Shared key derivation ───

async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );

  const keyMaterial = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('nftmail-ecies-v1'),
      info: new TextEncoder().encode('aes-256-gcm'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── SHA-256 hex ───

export async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buf = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return bytesToHex(new Uint8Array(hash));
}

// ─── Decrypt ───

export async function eciesDecrypt(
  envelope: EncryptedEnvelope,
  recipientPrivateKeyHex: string
): Promise<string> {
  const ephPub = await importPublicKey(envelope.ephemeralPublicKey);
  const recipientPriv = await importPrivateKey(recipientPrivateKeyHex);
  const aesKey = await deriveSharedKey(recipientPriv, ephPub);

  const ivBytes = hexToBytes(envelope.iv);
  const ciphertextBytes = hexToBytes(envelope.ciphertext);
  const ivBuf = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer;
  const ctBuf = ciphertextBytes.buffer.slice(ciphertextBytes.byteOffset, ciphertextBytes.byteOffset + ciphertextBytes.byteLength) as ArrayBuffer;

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf, tagLength: 128 },
    aesKey,
    ctBuf
  );

  const plaintext = new TextDecoder().decode(decrypted);

  const hash = await sha256Hex(plaintext);
  if (hash !== envelope.contentHash) {
    throw new Error('Content hash mismatch — message integrity compromised');
  }

  return plaintext;
}

// ─── Generate key pair (browser-side) ───

function bytesToBase64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(b64url: string): Uint8Array {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  return new Uint8Array(Array.from(bin).map(c => c.charCodeAt(0)));
}

export async function generateEciesKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const dBytes = base64urlToBytes(privJwk.d!);

  return {
    publicKey: bytesToHex(new Uint8Array(pubRaw)),
    privateKey: bytesToHex(dBytes),
  };
}

// ─── Key storage helpers (localStorage, scoped per agent) ───

const STORAGE_PREFIX = 'nftmail-ecies-privkey:';

export function storePrivateKey(agentName: string, privKeyHex: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + agentName, privKeyHex);
  } catch {}
}

export function loadPrivateKey(agentName: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + agentName);
  } catch {
    return null;
  }
}

export function clearPrivateKey(agentName: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + agentName);
  } catch {}
}

export function hasPrivateKey(agentName: string): boolean {
  return loadPrivateKey(agentName) !== null;
}
