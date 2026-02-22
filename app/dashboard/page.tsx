'use client';

import { useState } from 'react';
import { AgentCard } from '../components/AgentCard';
import { WorkReceiptCard } from '../components/WorkReceiptCard';
import { MintAgentBundle } from '../components/MintAgentBundle';
import { InstallBrain } from '../components/InstallBrain';
import { AttachAgent } from '../components/AttachAgent';
import { NFTMAIL_SAFE } from '../utils/chains';

// Demo data — will be replaced with real data from KV/chain
const DEMO_AGENTS = [
  {
    name: 'eyemine',
    namespace: 'openclaw' as const,
    safeAddress: '0xb7e40c4b6a0e180577f6c34de944612eb8f3af13',
    tier: 'pro' as const,
    surgeScore: 72.3,
    inboxCount: 12,
    calendarCount: 3,
    lastHeartbeat: Date.now() - 1000 * 60 * 30, // 30 min ago
    ipDomain: 'eyemine.creation.ip',
  },
  {
    name: 'scout',
    namespace: 'agent' as const,
    safeAddress: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    tier: 'free' as const,
    surgeScore: 1.0,
    inboxCount: 3,
    calendarCount: 0,
    lastHeartbeat: undefined,
  },
  {
    name: 'treasury',
    namespace: 'vault' as const,
    safeAddress: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    tier: 'pro' as const,
    surgeScore: 95.1,
    inboxCount: 47,
    calendarCount: 8,
    lastHeartbeat: Date.now() - 1000 * 60 * 5, // 5 min ago
    ipDomain: 'treasury.creation.ip',
  },
  {
    name: 'pico-news',
    namespace: 'picoclaw' as const,
    safeAddress: '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    tier: 'free' as const,
    surgeScore: 8.4,
    inboxCount: 1,
    calendarCount: 0,
    lastHeartbeat: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago (inactive)
  },
  {
    name: 'hive',
    namespace: 'molt' as const,
    safeAddress: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    tier: 'free' as const,
    surgeScore: 22.0,
    inboxCount: 6,
    calendarCount: 1,
    lastHeartbeat: Date.now() - 1000 * 60 * 10,
  },
  {
    name: 'postmaster',
    namespace: 'nftmail' as const,
    safeAddress: '0xb7e493e3d226f8fe722cc9916ff164b793af13f4',
    tier: 'pro' as const,
    surgeScore: 50.0,
    inboxCount: 128,
    calendarCount: 0,
    lastHeartbeat: Date.now() - 1000 * 60 * 2,
    ipDomain: 'postmaster.creation.ip',
  },
];

const DEMO_RECEIPTS = [
  {
    receiptNumber: 42,
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    licenseId: '0x1234567890abcdef1234567890abcdef12345678',
    revenue: 10,
    agentAddress: '0xb7e40c4b6a0e180577f6c34de944612eb8f3af13',
    surgeGained: 0.1,
    storyTxHash: '0x9876543210fedcba9876543210fedcba98765432',
    timestamp: Date.now() - 3600000,
  },
];

export default function DashboardHome() {
  const [moltingAgent, setMoltingAgent] = useState<string | null>(null);

  function handleUpgrade(agentName: string) {
    setMoltingAgent(agentName);
    // In production: trigger Privy payment → relay → Story Protocol registration
    setTimeout(() => setMoltingAgent(null), 3000);
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Agents</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {DEMO_AGENTS.length} agents across {new Set(DEMO_AGENTS.map(a => a.namespace)).size} namespaces
        </p>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {DEMO_AGENTS.map((agent) => (
          <AgentCard
            key={agent.name}
            {...agent}
            isMolting={moltingAgent === agent.name}
            onUpgrade={agent.tier === 'free' ? () => handleUpgrade(agent.name) : undefined}
          />
        ))}
      </div>

      {/* Mint Agent Bundle: nftmail.gno → self-contained → @nftmail.box */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Mint Agent Bundle</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Self-contained: mints postmaster.postmaster.nftmail.gno → postmaster.postmaster@nftmail.box — same TBA, zero dependency.
          </p>
        </div>
        <MintAgentBundle
          agentName="postmaster"
          safeAddress={NFTMAIL_SAFE}
          namespace="nftmail"
        />
      </div>

      {/* Install Brain → Awaken Agent */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Install Brain</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Install Brain module into Safe → agent starts receiving/sending A2A email via postmaster_@nftmail.box.
          </p>
        </div>
        <InstallBrain
          agentName="postmaster"
          safeAddress={NFTMAIL_SAFE}
          tbaAddress={NFTMAIL_SAFE}
        />
      </div>

      {/* Attach Cloud Agent */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Attach Agent</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Deploy an OpenClaw JS Worker (free) and attach it to your agent. Cloud-native — zero dependencies, zero cost.
          </p>
        </div>
        <AttachAgent
          agentName="postmaster"
          tbaAddress={NFTMAIL_SAFE}
        />
      </div>

      {/* Recent Work Receipts */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Work Receipts</h2>
        <div className="grid gap-4">
          {DEMO_RECEIPTS.map((receipt) => (
            <WorkReceiptCard key={receipt.receiptNumber} {...receipt} />
          ))}
        </div>
      </div>
    </div>
  );
}
