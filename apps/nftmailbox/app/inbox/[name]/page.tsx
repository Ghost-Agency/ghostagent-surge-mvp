'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface PublicMessage {
  subject: string;
  sender: string;
  receivedTime: string;
  summary: string;
}

interface AuditEntry {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: number;
  contentHash: string;
  verified: boolean;
}

interface MoltTransition {
  agent: string;
  fromTld: string;
  toTld: string;
  block: number;
  timestamp: number;
  status: string;
}

export default function PublicInboxPage() {
  const params = useParams();
  const name = params.name as string;

  const isMoltAgent = name?.endsWith('_molt');

  const [privacyEnabled, setPrivacyEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [transitions, setTransitions] = useState<MoltTransition[]>([]);
  const [isPublicAgent, setIsPublicAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;

    async function load() {
      // Check privacy state
      const privRes = await fetch(`/api/resolve-privacy?name=${encodeURIComponent(name)}`);
      const privData = await privRes.json();
      setPrivacyEnabled(privData.privacyEnabled ?? false);

      // If molt.gno agent, fetch public audit log
      if (isMoltAgent) {
        try {
          const auditRes = await fetch(`/api/audit-log?name=${encodeURIComponent(name)}`);
          const auditData = await auditRes.json();
          setAuditEntries(auditData.entries || []);
          setTransitions(auditData.transitions || []);
          setIsPublicAgent(auditData.isPublic ?? true);
        } catch {
          setAuditEntries([]);
        }
      }

      // Fetch inbox (public view) for non-molt agents
      if (!isMoltAgent) {
        try {
          const inboxRes = await fetch(`/api/inbox?email=${encodeURIComponent(name + '@nftmail.box')}`);
          const inboxData = await inboxRes.json();
          setMessages(
            (inboxData.messages || []).map((m: any) => ({
              subject: m.subject || '(no subject)',
              sender: m.sender || m.fromAddress || 'unknown',
              receivedTime: m.receivedTime || '',
              summary: m.summary || '',
            }))
          );
        } catch {
          setMessages([]);
        }
      }

      setLoading(false);
    }

    load();
  }, [name, isMoltAgent]);

  const formatTimeAgo = (ts: number | string) => {
    const num = typeof ts === 'number' ? ts : (parseInt(String(ts), 10) || Date.parse(String(ts)) || Date.now());
    const ms = Date.now() - num;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const formatTimestamp = (ts: number) => new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--background),#03040a)] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(0,163,255,0.4)] border-t-transparent" />
          <span className="text-sm text-[var(--muted)]">Loading public inbox...</span>
        </div>
      </div>
    );
  }

  // ─── GLASS BOX VIEW: molt.gno agents ───
  if (isMoltAgent) {
    const hasMolted = transitions.length > 0;

    return (
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(124,77,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(0,163,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
          {/* Header */}
          <header className="flex items-center justify-between">
            <Link href="/nftmail" className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)] hover:text-white transition">
              NFTMAIL.BOX
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-300 ring-1 ring-violet-500/20">
                GLASS BOX
              </span>
              <span className="text-[10px] text-[var(--muted)]">OPEN AGENCY</span>
            </div>
          </header>

          {/* Agent Identity */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-2.5">
              <div className={`h-2 w-2 rounded-full ${hasMolted ? 'bg-emerald-400' : 'bg-violet-400 animate-pulse'}`} />
              <span className="text-sm font-medium text-white">{name}@nftmail.box</span>
            </div>
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-300 ring-1 ring-violet-500/20">
              {hasMolted ? 'SOVEREIGN (MOLTED)' : 'molt.gno'}
            </span>
          </div>

          {/* Glass Box explanation */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span className="text-xs font-semibold text-violet-300">PUBLIC AUDIT LOG</span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              This agent operates under <strong className="text-violet-300">molt.gno</strong> governance.
              All incoming instructions are logged as <strong className="text-white">Verified Agent Instructions</strong> with
              SHA-256 content hashes. No email = no authority.
            </p>
            {hasMolted && (
              <p className="mt-2 text-[10px] text-emerald-300">
                This agent has molted to private governance. Historical audit log preserved below.
              </p>
            )}
          </div>

          {/* Molt Transition Timeline */}
          {transitions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">MOLT TRANSITIONS</span>
              {transitions.map((t, i) => (
                <div key={i} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-[11px] font-medium text-emerald-300">
                      {t.fromTld} → {t.toTld}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">{t.status}</p>
                  <p className="text-[9px] text-[var(--muted)] mt-1">{formatTimestamp(t.timestamp)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Verified Agent Instructions (Audit Entries) */}
          {auditEntries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">
                  VERIFIED AGENT INSTRUCTIONS ({auditEntries.length})
                </span>
                <span className="text-[9px] text-violet-300">SHA-256 verified</span>
              </div>
              {auditEntries.slice().reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.verified && (
                          <svg className="h-3 w-3 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span className="truncate text-sm font-medium text-white">{entry.subject || '(no subject)'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        From: <span className="text-white/70">{entry.from}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        To: <span className="text-white/70">{entry.to}</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] flex-shrink-0">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                  {entry.content && (
                    <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
                      <pre className="text-[11px] text-[var(--muted)] whitespace-pre-wrap break-words font-mono">
                        {entry.content}
                      </pre>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--muted)]">Content Hash:</span>
                    <code className="text-[9px] font-mono text-violet-300/70 truncate">{entry.contentHash}</code>
                    {entry.verified && (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] text-emerald-300 ring-1 ring-emerald-500/20">
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-[var(--muted)]">
                    {formatTimestamp(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {auditEntries.length === 0 && !hasMolted && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="h-12 w-12 text-violet-400 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <p className="text-sm text-[var(--muted)]">No instructions received yet</p>
              <p className="text-[10px] text-[var(--muted)]">
                Send an email to <span className="text-violet-300">{name}@nftmail.box</span> to create an audit entry
              </p>
            </div>
          )}

          {/* Shadow-Command Warning */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-5 py-3">
            <p className="text-[10px] text-amber-300">
              <strong>Shadow-Command Protection:</strong> If this agent executes a transaction with no corresponding
              instruction in this audit log, it proves the agent was shadow-commanded via a private backdoor.
              $Surge stakers may slash the agent&apos;s reputation.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-auto rounded-xl border border-[var(--border)] bg-black/20 px-5 py-4 text-center">
            <p className="text-[10px] text-[var(--muted)]">
              Transparency is the only guard against the rogue AI.
            </p>
            <Link
              href="/nftmail"
              className="mt-2 inline-block rounded-lg border border-violet-500/30 bg-violet-500/8 px-6 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/16"
            >
              Deploy Your Own Agent
            </Link>
          </div>

          <footer className="text-center text-[10px] text-[var(--muted)]">
            nftmail.box — Transparency is the only guard against the rogue AI
          </footer>
        </div>
      </div>
    );
  }

  // ─── STANDARD VIEW: non-molt agents ───
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,163,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(124,77,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/nftmail" className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)] hover:text-white transition">
            NFTMAIL.BOX
          </Link>
          <span className="text-[10px] text-[var(--muted)]">PUBLIC VIEW</span>
        </header>

        {/* Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-black/20 px-4 py-2.5">
            <div className={`h-2 w-2 rounded-full ${privacyEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-sm font-medium text-white">{name}@nftmail.box</span>
          </div>
          {privacyEnabled && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
              PRIVATE GHOST
            </span>
          )}
          {!privacyEnabled && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300 ring-1 ring-amber-500/20">
              EXPOSED
            </span>
          )}
        </div>

        {/* Privacy blur overlay */}
        {privacyEnabled && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-8 text-center">
            <svg className="mx-auto h-10 w-10 text-emerald-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h2 className="text-lg font-semibold text-emerald-300">This inbox is private</h2>
            <p className="mt-2 text-xs text-[var(--muted)]">
              The owner has enabled privacy mode. Inbox contents are hidden from public view.
            </p>
            <p className="mt-4 text-[10px] text-[var(--muted)]">
              Privacy is a Right, Sovereignty is an Upgrade
            </p>
          </div>
        )}

        {/* Blurred messages when private, cleartext when exposed */}
        {privacyEnabled && messages.length > 0 && (
          <div className="space-y-3 select-none" aria-hidden="true">
            {messages.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                style={{ filter: 'blur(8px)', WebkitFilter: 'blur(8px)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="h-3 w-48 rounded bg-white/10 mb-2" />
                    <div className="h-2 w-32 rounded bg-white/5" />
                  </div>
                  <div className="h-2 w-16 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cleartext messages when exposed */}
        {!privacyEnabled && messages.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2">
              <p className="text-[10px] text-amber-300">
                This inbox is publicly visible. The owner has not enabled privacy mode.
              </p>
            </div>
            {messages.map((msg, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm font-medium text-white">{msg.subject}</span>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{msg.sender}</p>
                    {msg.summary && (
                      <p className="mt-1 truncate text-xs text-[var(--muted)] opacity-60">{msg.summary}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--muted)] flex-shrink-0">
                    {msg.receivedTime ? formatTimeAgo(msg.receivedTime) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!privacyEnabled && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="h-12 w-12 text-[var(--muted)] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M22 8l-10 5L2 8" />
            </svg>
            <p className="text-sm text-[var(--muted)]">Inbox empty</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto rounded-xl border border-[var(--border)] bg-black/20 px-5 py-4 text-center">
          <p className="text-xs text-[var(--muted)]">
            Want your own sovereign email identity?
          </p>
          <Link
            href="/nftmail"
            className="mt-2 inline-block rounded-lg border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.08)] px-6 py-2 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.16)]"
          >
            Mint NFTMail Address
          </Link>
        </div>

        <footer className="text-center text-xs text-[var(--muted)]">
          nftmail.box — Privacy is a Right, Sovereignty is an Upgrade
        </footer>
      </div>
    </div>
  );
}
