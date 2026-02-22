'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { NFTLogin } from '../components/NFTLogin';
import { MintNFTMail } from '../components/MintNFTMail';
import { WhiteLabelZoho } from '../components/WhiteLabelZoho';

type Tier = 'none' | 'free' | 'premium';

export default function NftmailPage() {
  const { authenticated } = usePrivy();

  const [mintedName, setMintedName] = useState('');
  const [mintedTba, setMintedTba] = useState('');
  const [tier, setTier] = useState<Tier>('none');

  const email = mintedName ? `${mintedName}@nftmail.box` : '';

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,163,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(124,77,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10 md:px-6">
        <header className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">NFTMAIL.BOX</div>
          <div className="flex items-center gap-3">
            <a
              href="https://ghostagent.ninja/"
              className="rounded-full border border-[var(--border)] bg-black/20 px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-black/30"
            >
              GhostAgent.ninja
            </a>
          </div>
        </header>

        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">nftmail.box</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--muted)]">
            Mint a self-contained email identity on Gnosis. Start free, upgrade to premium.
          </p>
        </section>

        <div className="flex items-center justify-center gap-3">
          {[
            { key: 'free', label: 'Mint', icon: '1' },
            { key: 'premium', label: 'Upgrade', icon: '2' },
          ].map((s, i) => {
            const tierOrder: Tier[] = ['none', 'free', 'premium'];
            const currentIdx = tierOrder.indexOf(tier);
            const stepIdx = tierOrder.indexOf(s.key as Tier);
            const isDone = currentIdx >= stepIdx;
            const isCurrent = currentIdx === stepIdx - 1;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                        : isCurrent
                        ? 'bg-[rgba(0,163,255,0.15)] text-[rgb(160,220,255)] ring-1 ring-[rgba(0,163,255,0.4)] animate-pulse'
                        : 'bg-white/5 text-[var(--muted)] ring-1 ring-[var(--border)]'
                    }`}
                  >
                    {isDone ? '✓' : s.icon}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isDone ? 'text-emerald-400' : isCurrent ? 'text-[rgb(160,220,255)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < 1 && <div className={`h-px w-8 ${isDone ? 'bg-emerald-500/40' : 'bg-[var(--border)]'}`} />}
              </div>
            );
          })}
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(0,163,255,0.12)] text-[10px] font-bold text-[rgb(160,220,255)]">
                {authenticated ? '✓' : '1'}
              </div>
              <h2 className="text-lg font-semibold text-white">Connect</h2>
            </div>
            <p className="mt-1 ml-8 text-xs text-[var(--muted)]">Sign in with wallet or email to get started.</p>
          </div>
          <div className="ml-8">
            <NFTLogin />
          </div>
        </section>

        {authenticated && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    tier !== 'none' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[rgba(0,163,255,0.12)] text-[rgb(160,220,255)]'
                  }`}
                >
                  {tier !== 'none' ? '✓' : '2'}
                </div>
                <h2 className="text-lg font-semibold text-white">Mint NFTMail</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20">FREE</span>
              </div>
              <p className="mt-1 ml-8 text-xs text-[var(--muted)]">Mint [name1].[name2].nftmail.gno → get [name1].[name2]@nftmail.box.</p>
            </div>
            <div className="ml-8">
              {tier !== 'none' ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-emerald-300">{email}</span>
                  <span className="ml-auto text-[10px] text-[var(--muted)]">TBA: {mintedTba.slice(0, 8)}...</span>
                </div>
              ) : (
                <MintNFTMailWithCallback
                  onMinted={(name, tba) => {
                    setMintedName(name);
                    setMintedTba(tba);
                    setTier('free');
                  }}
                />
              )}
            </div>
          </section>
        )}

        {tier === 'free' || tier === 'premium' ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    tier === 'premium' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/15 text-violet-300'
                  }`}
                >
                  {tier === 'premium' ? '✓' : '3'}
                </div>
                <h2 className="text-lg font-semibold text-white">Upgrade to Premium</h2>
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/20">OPTIONAL</span>
              </div>
              <p className="mt-1 ml-8 text-xs text-[var(--muted)]">White-label Zoho mail — persistent storage, IMAP/SMTP, calendar + tasks.</p>
            </div>
            <div className="ml-8">
              {tier === 'premium' ? (
                <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-violet-400" />
                  <span className="text-sm text-violet-300">Zoho mailbox provisioned</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <WhiteLabelZoho agentName={mintedName} email={email} tbaAddress={mintedTba} />
                  <button
                    onClick={() => setTier('premium')}
                    className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-4 py-2 text-xs text-[var(--muted)] transition hover:text-white"
                  >
                    Skip — stay on free tier →
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {(tier === 'free' || tier === 'premium') && (
          <section className="rounded-2xl border border-amber-500/20 bg-[var(--card)] p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <h2 className="text-lg font-semibold text-white">Want a full autonomous agent?</h2>
              </div>
              <p className="mt-1 ml-7 text-xs text-[var(--muted)]">
                Your nftmail.gno identity can evolve into a full GhostAgent — same TBA, same email, plus a Gnosis Safe + Brain module for autonomous execution.
              </p>
            </div>
            <div className="ml-7">
              <a
                href="https://ghostagent.ninja/"
                className="group inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-3 text-sm font-semibold text-amber-200 transition-all hover:bg-amber-500/15 hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]"
              >
                Molt to Agent on GhostAgent.ninja
                <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-[var(--muted)]">nftmail.box — self-contained minting — no creation.ip required — zero dependency.</footer>
      </div>
    </div>
  );
}

function MintNFTMailWithCallback({ onMinted }: { onMinted: (name: string, tba: string) => void }) {
  const [manualName, setManualName] = useState('');
  const [manualTba, setManualTba] = useState('');
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="space-y-3">
      <MintNFTMail />
      {!showManual ? (
        <button
          onClick={() => setShowManual(true)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-4 py-2 text-xs text-[var(--muted)] transition hover:text-white"
        >
          Already minted? Enter details →
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-black/20 p-4">
          <div className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">CONFIRM MINT</div>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
            placeholder="Name (e.g. alice.ops)"
            className="w-full rounded-lg border border-[var(--border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[rgba(0,163,255,0.5)]"
          />
          <input
            type="text"
            value={manualTba}
            onChange={(e) => setManualTba(e.target.value)}
            placeholder="TBA address (0x...)"
            className="w-full rounded-lg border border-[var(--border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[rgba(0,163,255,0.5)]"
          />
          <button
            onClick={() => {
              if (manualName && manualTba) onMinted(manualName, manualTba);
            }}
            disabled={!manualName || !manualTba}
            className="w-full rounded-lg bg-[rgba(0,163,255,0.12)] px-4 py-2 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.2)] disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
