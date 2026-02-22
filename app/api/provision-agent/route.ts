import { NextResponse } from 'next/server';
import { mintCreationIP } from '../../lib/story-mint';

/// POST /api/provision-agent
/// Called after user mints [name].agent.gno on Gnosis and gets a TBA address.
/// Server-side: mints [name].creation.ip on Story L1 → same TBA
/// Email routing ([name]_@nftmail.box) is handled by the CF worker KV inbox (free tier).
/// Zoho mailbox provisioning is a paid tier upgrade.
///
/// Body: { agentName: string, tbaAddress: `0x${string}` }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { agentName?: string; tbaAddress?: string };
    const { agentName, tbaAddress } = body;

    if (!agentName || typeof agentName !== 'string') {
      return NextResponse.json({ error: 'Missing agentName' }, { status: 400 });
    }
    if (!tbaAddress || !/^0x[a-fA-F0-9]{40}$/.test(tbaAddress)) {
      return NextResponse.json({ error: 'Invalid tbaAddress' }, { status: 400 });
    }

    // Mint [name].creation.ip on Story L1 (treasury wallet signs)
    const storyMint = await mintCreationIP(agentName, tbaAddress as `0x${string}`);

    // Free tier email: [name]_@nftmail.box is already routed by CF worker → KV inbox
    const email = `${agentName}_@nftmail.box`;

    return NextResponse.json({
      success: true,
      agentName,
      tbaAddress,
      storyMint,
      email,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
