export interface Env {
  GNOSIS_RPC_URL: string;
  GHOSTAGENT_REGISTRY_ADDRESS: string;
  FORWARD_ENDPOINT: string;
  FORWARD_BEARER_TOKEN?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type JsonRpcResponse<T> = {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

const LOCALPART_UNDERSCORE_RE = /^([a-z0-9]+)_$/;

function strip0x(hex: string) {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function pad32(hexNo0x: string) {
  return hexNo0x.padStart(64, '0');
}

function encodeStringArg(s: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(s);
  const len = bytes.length;

  const head = pad32('20');
  const lenHex = pad32(len.toString(16));

  let data = '';
  for (const b of bytes) data += b.toString(16).padStart(2, '0');
  const paddedData = data.padEnd(Math.ceil(data.length / 64) * 64, '0');

  return '0x' + head + lenHex + paddedData;
}

async function jsonRpc<T>(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }

  const body = (await res.json()) as JsonRpcResponse<T>;
  if (body.error) {
    throw new Error(`RPC error ${body.error.code}: ${body.error.message}`);
  }
  if (body.result === undefined) {
    throw new Error('RPC missing result');
  }
  return body.result;
}

async function ethCall(rpcUrl: string, to: string, data: string) {
  return jsonRpc<string>(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
}

function decodeUint256(hex: string) {
  const v = BigInt(hex);
  return v;
}

function decodeAddress(hex: string) {
  const h = strip0x(hex);
  if (h.length !== 64) throw new Error('Invalid address return length');
  return ('0x' + h.slice(24)) as `0x${string}`;
}

// nameToId(string) -> uint256
const SIG_NAME_TO_ID = '0xd7e6bcf8';
// safeOf(uint256) -> address
const SIG_SAFE_OF = '0x9e3fcad2';

async function resolveSafeForAgentName(env: Env, agentName: string) {
  const registry = env.GHOSTAGENT_REGISTRY_ADDRESS;
  if (!registry || registry === '0x0000000000000000000000000000000000000000') {
    throw new Error('GHOSTAGENT_REGISTRY_ADDRESS not configured');
  }

  const dataNameToId = SIG_NAME_TO_ID + strip0x(encodeStringArg(agentName));
  const tokenIdHex = await ethCall(env.GNOSIS_RPC_URL, registry, dataNameToId);
  const tokenId = decodeUint256(tokenIdHex);

  const dataSafeOf =
    SIG_SAFE_OF + pad32(tokenId.toString(16));
  const safeHex = await ethCall(env.GNOSIS_RPC_URL, registry, dataSafeOf);
  const safe = decodeAddress(safeHex);

  if (safe.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('Resolved safe is zero address');
  }

  return { tokenId: tokenId.toString(), safe };
}

async function streamToBase64(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }

  let binary = '';
  for (let i = 0; i < all.length; i++) binary += String.fromCharCode(all[i]);
  // btoa is available in Workers runtime
  return btoa(binary);
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const to = message.to;
    const [localPart, domain] = to.split('@');

    if (!localPart || !domain || domain.toLowerCase() !== 'nftmail.box') {
      message.setReject('Invalid recipient');
      return;
    }

    const match = LOCALPART_UNDERSCORE_RE.exec(localPart);
    if (!match?.[1]) {
      message.setReject('Invalid agent address');
      return;
    }

    const agentName = match[1];

    let resolution: { tokenId: string; safe: `0x${string}` };
    try {
      resolution = await resolveSafeForAgentName(env, agentName);
    } catch (e) {
      message.setReject(`Unknown agent: ${agentName}`);
      return;
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of message.headers) headers[k] = v;

    const rawBase64 = await streamToBase64(message.raw);

    const payload = {
      agent: {
        name: agentName,
        tokenId: resolution.tokenId,
        safe: resolution.safe,
      },
      email: {
        from: message.from,
        to: message.to,
        subject: message.subject,
        headers,
        rawBase64,
      },
    };

    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (env.FORWARD_BEARER_TOKEN) {
      forwardHeaders.authorization = `Bearer ${env.FORWARD_BEARER_TOKEN}`;
    }

    const forwardPromise = fetch(env.FORWARD_ENDPOINT, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(payload),
    });

    ctx.waitUntil(forwardPromise);
  },
};

// Cloudflare Email Workers types (minimal)
interface ForwardableEmailMessage {
  from: string;
  to: string;
  subject: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
  setReject(reason: string): void;
}
