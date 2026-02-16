'use client';

import Link from 'next/link';

export default function NftmailPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,163,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(124,77,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-4 py-10 md:px-6">
        <header className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">NFTMAIL.BOX</div>
          <Link
            href="/"
            className="rounded-full border border-[var(--border)] bg-black/20 px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-black/30"
          >
            Back to GhostAgent
          </Link>
        </header>

        <main className="grid gap-10">
          <section className="grid gap-4">
            <h1 className="text-4xl font-bold tracking-tight">Email as composable legos</h1>
            <p className="max-w-2xl text-sm text-[var(--muted)]">
              nftmail.box is a minimal “mail ingest + encryption + storage” primitive designed to plug into your agent identity.
              It captures inbound email, encrypts it, pins it to IPFS, and stores only a content hash onchain.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#stack"
                className="rounded-full border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-4 py-2 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)]"
              >
                View the stack
              </a>
              <Link
                href="/"
                className="rounded-full border border-[var(--border)] bg-black/20 px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-black/30"
              >
                Mint an agent
              </Link>
            </div>
          </section>

          <section id="stack" className="rounded-2xl border border-[var(--border)] bg-black/20 p-6">
            <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">THE LEGO STACK</div>
            <div className="mt-4 grid gap-4">
              <StackCard
                step="1"
                title="MX catch-all"
                body="A Cloudflare Email Worker receives inbound mail for *.nftmail.box (or per-agent mailboxes) and normalizes the payload."
                bullets={["Catch-all routing", "Headers + body extraction", "Attachment handling (optional)"]}
              />
              <StackCard
                step="2"
                title="Encrypt"
                body="The email body is encrypted client-side style (or in-worker) so plaintext never hits your database."
                bullets={["Per-agent encryption key", "Future: threshold / Safe owners", "Future: view-permissions"]}
              />
              <StackCard
                step="3"
                title="Pin to IPFS"
                body="Encrypted content is pinned to IPFS. This gives durable, content-addressed storage without trusting a centralized inbox provider."
                bullets={["CID returned", "Optional redundancy pinning", "Works with gateways"]}
              />
              <StackCard
                step="4"
                title="Store hash"
                body="Only the CID / hash is written to an index (KV/D1) and/or an onchain registry. Your agent can pull the content when needed."
                bullets={["Onchain pointer", "Cheap indexing", "Auditable provenance"]}
              />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-6">
              <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">WHY THIS EXISTS</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                <p>
                  Modern agents need an inbox that is:
                  <span className="text-[var(--foreground)]"> non-custodial</span>, composable, and portable.
                </p>
                <p>
                  nftmail.box is the smallest useful primitive: capture → encrypt → store → reference.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-6">
              <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">MVP STATUS</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                <p>
                  Today: Worker ingests mail and stores encrypted bodies + CIDs.
                </p>
                <p>
                  Next: per-agent mailboxes bound to your GhostAgent identity + onchain pointers.
                </p>
              </div>
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-5 py-3 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.18)]"
                >
                  Go to GhostAgent
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="pt-2 text-center text-xs text-[var(--muted)]">
          nftmail.box is a primitive. GhostAgent.ninja is the identity layer.
        </footer>
      </div>
    </div>
  );
}

function StackCard({
  step,
  title,
  body,
  bullets,
}: {
  step: string;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-2 text-xs text-[var(--muted)]">{body}</div>
        </div>
        <div className="shrink-0 rounded-full border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-3 py-1 text-xs font-semibold text-[rgb(160,220,255)]">
          Step {step}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {bullets.map((b) => (
          <div key={b} className="rounded-xl border border-[var(--border)] bg-black/20 px-3 py-2 text-xs text-[var(--muted)]">
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}
