'use client';

import { useState } from 'react';

type Namespace = 'agent' | 'openclaw' | 'molt' | 'picoclaw' | 'vault';

const TIERS: Record<Namespace, { title: string; description: string; domain: string; features: string[] }> = {
  agent: {
    title: 'General Purpose Registry',
    description:
      'The industry-standard foundational identity for the autonomous web. The default namespace for rapid, high-volume onboarding and A2A commerce — without specialized tier overhead.',
    domain: 'agent.gno',
    features: [
      'Universal interoperability (default A2A identity)',
      'Fast-track deployment for swarm onboarding',
      'Essential logic for _@nftmail.box routing',
      'Parent namespace for pico/tiny/small classes'
    ]
  },
  openclaw: {
    title: 'Flagship Worker',
    description: 'Enterprise-grade agent identity for professional automation and brand presence. Ideal for businesses and power users who need reliable, high-performance automation with a strong brand identity.',
    domain: 'openclaw.gno',
    features: [
      'Premium bot labor capabilities',
      'Memorable, brandable subdomains',
      'High-throughput automation',
      'Priority execution in network'
    ]
  },
  molt: {
    title: 'Social',
    description: 'Community-focused agent identity optimized for social engagement and coordination. Perfect for DAOs, communities, and social protocols that need trusted automation.',
    domain: 'molt.gno',
    features: [
      'Social coordination primitives',
      'Multi-party automation flows',
      'Community governance hooks',
      'Reputation system integration'
    ]
  },
  picoclaw: {
    title: 'Micro-Worker',
    description: 'Lightweight agent identity for personal automation and information delivery. Great for individuals who want automated news feeds, alerts, and basic task automation.',
    domain: 'picoclaw.gno',
    features: [
      'Personal news delivery',
      'Custom alert systems',
      'Efficient micro-tasks',
      'Low-cost operations'
    ]
  },
  vault: {
    title: 'Treasury',
    description: 'Premium agent identity for secure asset management and DeFi automation. Built for institutions and high-net-worth individuals who need secure, automated treasury operations.',
    domain: 'vault.gno',
    features: [
      'Institutional-grade security',
      'Advanced DeFi integrations',
      'Multi-sig compatibility',
      'Automated rebalancing'
    ]
  }
};

const registrarByNamespace: Record<Namespace, string> = {
  agent: process.env.NEXT_PUBLIC_REGISTRAR_AGENT ?? '0x0000000000000000000000000000000000000000',
  openclaw: process.env.NEXT_PUBLIC_REGISTRAR_OPENCLAW ?? '0x0000000000000000000000000000000000000000',
  molt: process.env.NEXT_PUBLIC_REGISTRAR_MOLT ?? '0x0000000000000000000000000000000000000000',
  picoclaw: process.env.NEXT_PUBLIC_REGISTRAR_PICOCLAW ?? '0x0000000000000000000000000000000000000000',
  vault: process.env.NEXT_PUBLIC_REGISTRAR_VAULT ?? '0x0000000000000000000000000000000000000000'
};

export function NamespaceSelect() {
  const [namespace, setNamespace] = useState<Namespace>('openclaw');
  const activeRegistrar = registrarByNamespace[namespace];
  const selectedTier = TIERS[namespace];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
      <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">SELECT NAMESPACE</div>
      <div className="mt-4 grid gap-3">
        {(Object.keys(TIERS) as Namespace[]).map((key) => {
          const tier = TIERS[key];
          const isSelected = namespace === key;
          
          return (
            <button
              key={key}
              onClick={() => setNamespace(key)}
              className={`group flex flex-col gap-3 rounded-xl border p-4 text-left transition ${isSelected ? 'border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)]' : 'border-[var(--border)] bg-black/30 hover:border-[rgba(0,163,255,0.22)] hover:bg-[rgba(0,163,255,0.08)]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{tier.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{tier.description}</div>
                </div>
                <div className="shrink-0 rounded-md border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-2 py-1 text-xs font-medium text-[rgb(160,220,255)]">
                  {tier.domain}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {tier.features.map((feature, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${isSelected ? 'border-[rgba(0,163,255,0.22)] bg-black/30' : 'border-[var(--border)] bg-black/20'}`}
                  >
                    <svg
                      className={`h-3 w-3 ${isSelected ? 'text-[rgb(160,220,255)]' : 'text-[var(--muted)]'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className={isSelected ? 'text-[rgb(160,220,255)]' : 'text-[var(--muted)]'}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {isSelected && (
                <div className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2">
                  <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">REGISTRAR</div>
                  <div className="mt-1 truncate font-mono text-xs text-[rgb(180,190,210)]">{activeRegistrar}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-[var(--muted)]">
        Select your agent's tier and namespace. Each comes with different capabilities and use cases.
      </div>
    </div>
  );
}
