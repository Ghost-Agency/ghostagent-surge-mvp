import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const ETH_RPC = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
const ETH_RPC_FALLBACKS = [
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
];

// Race all RPCs simultaneously — return first non-null result within ms
async function raceEnsName(address: `0x${string}`, ms: number): Promise<string | null> {
  const rpcs = [ETH_RPC, ...ETH_RPC_FALLBACKS];
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), ms));
  const races = rpcs.map(rpc => {
    const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
    return client.getEnsName({ address }).catch(() => null);
  });
  // Resolve to first non-null value, or null if all fail/timeout
  return new Promise(resolve => {
    let settled = 0;
    const total = races.length;
    let resolved = false;
    timeout.then(() => { if (!resolved) { resolved = true; resolve(null); } });
    races.forEach(p => p.then(val => {
      settled++;
      if (!resolved && val) { resolved = true; resolve(val); }
      else if (!resolved && settled === total) { resolved = true; resolve(null); }
    }));
  });
}

// ENS × Email intersection validator (must match Worker's isValidSovereignName)
function isValidSovereignName(name: string): boolean {
  if (name.length < 3) return false;
  if (name.includes('_')) return false;
  if (!/^[a-z0-9.-]+$/.test(name)) return false;
  if (/^[.-]|[.-]$/.test(name)) return false;
  if (/\.\.|-{2}/.test(name)) return false;
  return true;
}


export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const addr = address as `0x${string}`;

    // Race all 4 RPCs simultaneously — first non-null result wins, 8s hard timeout
    const ensName: string | null = await raceEnsName(addr, 8000);

    const ensNftCount = 0; // balanceOf check deferred — not needed for ENS row creation

    // 3. If we have a primary ENS name, extract the label (strip .eth)
    let ensLabel: string | null = null;
    if (ensName && ensName.endsWith('.eth')) {
      const parts = ensName.split('.');
      if (parts.length === 2) {
        // Simple name like "vitalik.eth" → "vitalik"
        ensLabel = parts[0].toLowerCase();
      }
      // Subdomains like "sub.vitalik.eth" — use full prefix
      if (parts.length > 2) {
        ensLabel = parts.slice(0, -1).join('.').toLowerCase();
      }
    }

    // Check if the ENS label qualifies for nftmail.box sovereign address
    let qualifiesForNftmail = false;
    let disqualifyReason: string | null = null;
    if (ensLabel) {
      if (isValidSovereignName(ensLabel)) {
        qualifiesForNftmail = true;
      } else {
        if (ensLabel.includes('_')) {
          disqualifyReason = 'Contains underscore — reserved for agent addresses';
        } else if (ensLabel.length < 3) {
          disqualifyReason = 'Too short — minimum 3 characters required';
        } else if (/[^a-z0-9.-]/.test(ensLabel)) {
          disqualifyReason = 'Contains characters outside the ENS × Email intersection';
        } else {
          disqualifyReason = 'Does not meet ENS × Email character requirements';
        }
      }
    }

    return NextResponse.json({
      address: addr,
      ensName,              // Full ENS name e.g. "vitalik.eth"
      ensLabel,             // Stripped label e.g. "vitalik"
      ensNftCount,
      hasEns: !!ensName,
      qualifiesForNftmail,  // Whether this ENS name can claim a sovereign nftmail.box
      disqualifyReason,     // Why it doesn't qualify (null if it does)
    });
  } catch (err: any) {
    console.error('resolve-ens error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to resolve ENS' },
      { status: 500 }
    );
  }
}
