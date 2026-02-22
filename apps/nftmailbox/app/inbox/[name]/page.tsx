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

export default function PublicInboxPage() {
  const params = useParams();
  const name = params.name as string;

  const [privacyEnabled, setPrivacyEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;

    async function load() {
      // Check privacy state
      const privRes = await fetch(`/api/resolve-privacy?name=${encodeURIComponent(name)}`);
      const privData = await privRes.json();
      setPrivacyEnabled(privData.privacyEnabled ?? false);

      // Fetch inbox (public view)
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

      setLoading(false);
    }

    load();
  }, [name]);

  const formatTimeAgo = (ts: string) => {
    const ms = Date.now() - (parseInt(ts, 10) || Date.parse(ts) || Date.now());
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

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
