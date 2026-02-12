"use client";

import { AnimatePresence, motion } from "framer-motion";
import AgentAuditCard from "@/components/AgentAuditCard";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type TabKey = "identity" | "mailbox" | "vault" | "ip";

type InboundAgentMessage = {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body_preview: string;
  ipfs_hash: string;
  status: "Verified" | "Encrypted" | string;
  timestamp: string;
};

function Badge({ children, variant }: { children: ReactNode; variant: "ok" | "info" }) {
  const classes =
    variant === "ok"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] text-[rgb(160,220,255)]";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${classes}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-6 shadow-[0_0_0_1px_rgba(0,163,255,0.06),0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<TabKey>("identity");
  const [handle, setHandle] = useState<string>("alice.molt.gno");
  const [checked, setChecked] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string>("0x0000000000000000000000000000000000000000");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>("msg_001");
  const [copied, setCopied] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const inboundAgentData = useMemo<InboundAgentMessage[]>(
    () => [
      {
        id: "msg_001",
        sender: "oracle.molt.gno",
        recipient: "alice@nftmail.box",
        subject: "Market Data: GNO/xDAI",
        body_preview: "Current price trend analysis for Gnosis Chain...",
        ipfs_hash: "QmXoyp...789",
        status: "Verified",
        timestamp: "2026-02-12T14:30:00Z",
      },
      {
        id: "msg_002",
        sender: "governance@gnosis.dao",
        recipient: "alice@nftmail.box",
        subject: "GIP-128 Voting Instruction",
        body_preview: "Instruction to vote 'YES' on the upcoming protocol upgrade...",
        ipfs_hash: "QmZk4v...456",
        status: "Encrypted",
        timestamp: "2026-02-12T15:45:00Z",
      },
    ],
    []
  );

  const selectedMessage = useMemo(
    () => inboundAgentData.find((m) => m.id === selectedMessageId) ?? null,
    [inboundAgentData, selectedMessageId]
  );

  const tabs: Array<{ key: TabKey; label: string; description: string }> = [
    { key: "identity", label: "Identity", description: "Agent handle + mailbox link" },
    { key: "mailbox", label: "Mailbox", description: "Inbound agent data" },
    { key: "vault", label: "Vault", description: "Safe + Gnosis Pay status" },
    { key: "ip", label: "IP Rights", description: "Proofs, rights, claims" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,163,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(124,77,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card-2)]/80 p-4 md:flex">
          <div className="rounded-xl border border-[rgba(0,163,255,0.22)] bg-[rgba(0,163,255,0.08)] p-4">
            <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">
              GHOSTAGENT
            </div>
            <div className="mt-2 text-lg font-semibold tracking-tight">Dashboard</div>
            <div className="mt-1 text-sm text-[var(--muted)]">Claw-grade visibility.</div>
          </div>

          <nav className="flex flex-col gap-1">
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`group flex w-full items-start justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.10)]"
                      : "border-transparent hover:border-[rgba(255,255,255,0.10)] hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-xs text-[var(--muted)]">{t.description}</span>
                  </div>
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${
                      active ? "bg-[var(--accent)]" : "bg-white/10 group-hover:bg-white/20"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-[var(--border)] bg-black/20 p-4">
            <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">STATUS</div>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Edge runtime</span>
                <span className="font-semibold text-[rgb(160,220,255)]">Enabled</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Signal</span>
                <span className="font-semibold">Nominal</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col gap-6">
          <header className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(0,0,0,0.35)] p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">CONTROL SURFACE</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">GhostAgent Dashboard</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">Electric Blue</Badge>
                <Badge variant="ok">High Contrast</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:hidden">
              {tabs.map((t) => {
                const active = t.key === tab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[rgba(0,163,255,0.45)] bg-[rgba(0,163,255,0.12)]"
                        : "border-[var(--border)] bg-white/[0.02] text-[var(--muted)]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-col gap-6"
            >
              {tab === "identity" ? (
                <Panel
                  title="Identity"
                  subtitle="Check an agent handle and confirm its mailbox linkage."
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-[var(--muted)]">Agent handle</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={handle}
                          onChange={(e) => setHandle(e.target.value)}
                          placeholder="alice.molt.gno"
                          className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/30 px-4 text-sm outline-none ring-0 transition focus:border-[rgba(0,163,255,0.55)] focus:shadow-[0_0_0_3px_rgba(0,163,255,0.12)]"
                        />
                        <button
                          type="button"
                          onClick={() => setChecked(true)}
                          className="h-11 shrink-0 rounded-xl border border-[rgba(0,163,255,0.40)] bg-[rgba(0,163,255,0.12)] px-5 text-sm font-semibold text-[rgb(180,235,255)] shadow-[0_0_0_1px_rgba(0,163,255,0.06)] transition hover:bg-[rgba(0,163,255,0.18)]"
                        >
                          Check
                        </button>
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        Tip: try <span className="font-semibold text-[rgb(160,220,255)]">alice.molt.gno</span>
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <div className="font-semibold">Result</div>
                          <div className="text-xs text-[var(--muted)]">
                            {checked ? "Resolved identity record." : "Run a check to resolve status."}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {checked ? (
                            <>
                              <Badge variant="ok">Active Agent</Badge>
                              <Badge variant="info">Linked to alice@nftmail.box</Badge>
                            </>
                          ) : (
                            <Badge variant="info">Pending</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/30 p-3 text-xs text-[var(--muted)]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[rgb(180,235,255)]">Handle</span>
                          <span className="font-mono">{handle || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}

              {tab === "mailbox" ? (
                <Panel
                  title="Mailbox"
                  subtitle="Inbound Agent Data (mock stream)."
                >
                  <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                      <div className="flex items-center justify-between border-b border-[var(--border)] bg-black/25 px-4 py-3">
                        <div className="text-sm font-semibold">Inbound Agent Data</div>
                        <div className="text-xs text-[var(--muted)]">{inboundAgentData.length} messages</div>
                      </div>
                      <ul className="divide-y divide-[var(--border)]">
                        {inboundAgentData.map((item) => {
                          const active = item.id === selectedMessageId;
                          const statusVariant = item.status === "Verified" ? "ok" : "info";

                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMessageId(item.id);
                                  setCopied(false);
                                }}
                                className={`w-full p-4 text-left transition-colors hover:bg-white/[0.02] ${
                                  active ? "bg-[rgba(0,163,255,0.06)]" : "bg-transparent"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-semibold">{item.sender}</span>
                                    </div>
                                    <div className="mt-1 truncate text-sm text-[var(--muted)]">{item.subject}</div>
                                  </div>
                                  <div className="shrink-0">
                                    <Badge variant={statusVariant}>{item.status}</Badge>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                                  <span className="truncate">To: {item.recipient}</span>
                                  <span className="shrink-0">{new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
                      <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">MESSAGE</div>
                      <div className="mt-2 text-sm font-semibold">
                        {selectedMessage ? selectedMessage.subject : "Select a message"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {selectedMessage ? `From: ${selectedMessage.sender}` : ""}
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!selectedMessage}
                          onClick={() => {
                            setReplyBody("");
                            setReplyOpen(true);
                            setSending(false);
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-[rgba(0,163,255,0.45)] bg-[rgba(0,163,255,0.14)] px-4 py-2 text-sm font-semibold text-[rgb(180,235,255)] shadow-[0_0_0_1px_rgba(0,163,255,0.10),0_0_32px_rgba(0,163,255,0.12)] transition hover:bg-[rgba(0,163,255,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reply as Agent
                        </button>
                      </div>

                      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/30 p-4">
                        <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">IPFS HASH</div>
                        <div className="mt-2 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2">
                            <span className="truncate font-mono text-xs text-[rgb(180,190,210)]">
                              {selectedMessage ? selectedMessage.ipfs_hash : "—"}
                            </span>
                            <button
                              type="button"
                              disabled={!selectedMessage}
                              onClick={async () => {
                                if (!selectedMessage) return;
                                try {
                                  await navigator.clipboard.writeText(selectedMessage.ipfs_hash);
                                  setCopied(true);
                                  window.setTimeout(() => setCopied(false), 1200);
                                } catch {
                                  setCopied(false);
                                }
                              }}
                              className="shrink-0 rounded-md border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.12)] px-3 py-1.5 text-xs font-semibold text-[rgb(180,235,255)] transition hover:bg-[rgba(0,163,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {copied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            Click a message to reveal its content address.
                          </div>
                        </div>
                      </div>

                      {selectedMessage ? (
                        <div className="mt-4 text-xs text-[var(--muted)]">
                          {selectedMessage.body_preview}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              ) : null}

              {tab === "vault" ? (
                <Panel
                  title="Vault"
                  subtitle="Safe SDK integration planned: showing placeholders for now."
                >
                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
                      <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">SAFE ADDRESS</div>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={safeAddress}
                          onChange={(e) => setSafeAddress(e.target.value)}
                          placeholder="0x..."
                          className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/30 px-4 text-sm font-mono outline-none transition focus:border-[rgba(0,163,255,0.55)] focus:shadow-[0_0_0_3px_rgba(0,163,255,0.12)]"
                        />
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Gnosis Chain Safe address used to audit native xDAI balance.
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                      <AgentAuditCard safeAddress={safeAddress} />

                      <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
                        <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">PAYMENTS</div>
                        <div className="mt-2 text-2xl font-semibold">Gnosis Pay Status</div>
                        <div className="mt-2 text-sm text-[var(--muted)]">Not connected</div>
                        <div className="mt-4 text-xs text-[var(--muted)]">
                          Will reflect card status + settlement once connected.
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}

              {tab === "ip" ? (
                <Panel
                  title="IP Rights"
                  subtitle="Proof packets, rights claims, and audit trail."
                >
                  <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5">
                    <div className="text-sm font-semibold">Coming online</div>
                    <div className="mt-2 text-sm text-[var(--muted)]">
                      This stage will display IP proofs, license states, and signatures.
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/30 p-4">
                        <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">PROOF</div>
                        <div className="mt-2 text-sm">Draft packet</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">Pending signature</div>
                      </div>
                      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/30 p-4">
                        <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">CLAIMS</div>
                        <div className="mt-2 text-sm">Rights ledger</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">Awaiting ingestion</div>
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {replyOpen ? (
          <motion.div
            key="reply-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => (sending ? null : setReplyOpen(false))}
              className="absolute inset-0 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[rgba(0,163,255,0.22)] bg-[linear-gradient(180deg,rgba(11,16,32,0.92),rgba(6,8,16,0.92))] shadow-[0_0_0_1px_rgba(0,163,255,0.08),0_40px_120px_rgba(0,0,0,0.75)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">REPLY AS AGENT</div>
                  <div className="mt-1 text-sm font-semibold">Secure response composer</div>
                </div>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setReplyOpen(false)}
                  className="rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-black/25 p-3">
                    <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">FROM (LOCKED)</div>
                    <div className="mt-2 truncate font-mono text-xs text-[rgb(180,190,210)]">{handle}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-black/25 p-3">
                    <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">TO</div>
                    <div className="mt-2 truncate font-mono text-xs text-[rgb(180,190,210)]">
                      {selectedMessage ? selectedMessage.sender : "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)]">MESSAGE</div>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Draft your encrypted response…"
                    className="mt-2 h-36 w-full resize-none rounded-xl border border-[var(--border)] bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-[rgba(0,163,255,0.55)] focus:shadow-[0_0_0_3px_rgba(0,163,255,0.12)]"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[var(--muted)]">
                    {sending ? "Encrypting & Signing..." : "Response will be routed via nftmail.box"}
                  </div>
                  <button
                    type="button"
                    disabled={sending || !replyBody.trim() || !selectedMessage}
                    onClick={() => {
                      if (!selectedMessage) return;
                      setSending(true);
                      window.setTimeout(() => {
                        setSending(false);
                        setReplyOpen(false);
                        setToast("Response routed via nftmail.box. IPFS Receipt: Qm...");
                        window.setTimeout(() => setToast(null), 3000);
                      }, 2000);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(0,163,255,0.50)] bg-[rgba(0,163,255,0.16)] px-5 py-2 text-sm font-semibold text-[rgb(180,235,255)] shadow-[0_0_0_1px_rgba(0,163,255,0.12),0_0_40px_rgba(0,163,255,0.16)] transition hover:bg-[rgba(0,163,255,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-[rgba(0,163,255,0.85)]" />
                        Encrypting & Signing...
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-5 right-5 z-50 w-[min(520px,calc(100vw-2.5rem))] rounded-2xl border border-[rgba(0,163,255,0.25)] bg-[rgba(11,16,32,0.92)] p-4 shadow-[0_0_0_1px_rgba(0,163,255,0.10),0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">SUCCESS</div>
                <div className="mt-1 text-sm text-[var(--foreground)]">{toast}</div>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-white/[0.06]"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
