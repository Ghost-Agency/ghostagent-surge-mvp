/// @module waku
/// Zero-Knowledge Metadata Privacy layer for NFTMail
/// Replaces SMTP metadata exposure with Waku gossip protocol topics.
/// Messages are routed via content-topics — no IP, no sender metadata on the wire.

const WAKU_CONTENT_TOPIC_PREFIX = '/nftmail/1';

/// Build a deterministic direct-message content topic for two peers.
/// Topic = /nftmail/1/dm-<sorted-hash>/proto
/// Sorting ensures both sides derive the same topic regardless of who initiates.
export function buildDirectMessageTopic(peerA: string, peerB: string): string {
  const sorted = [peerA.toLowerCase(), peerB.toLowerCase()].sort();
  const combined = sorted.join(':');
  // Simple FNV-1a hash for deterministic topic derivation (no crypto import needed)
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${WAKU_CONTENT_TOPIC_PREFIX}/dm-${hex}/proto`;
}

/// Build a broadcast content topic for an agent's public channel.
/// Topic = /nftmail/1/broadcast-<agent>/proto
export function buildBroadcastTopic(agentName: string): string {
  return `${WAKU_CONTENT_TOPIC_PREFIX}/broadcast-${agentName.toLowerCase()}/proto`;
}

/// Build an encrypted group topic for multi-party A2A.
/// Topic = /nftmail/1/group-<sorted-hash>/proto
export function buildGroupTopic(participants: string[]): string {
  const sorted = participants.map(p => p.toLowerCase()).sort();
  const combined = sorted.join(':');
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${WAKU_CONTENT_TOPIC_PREFIX}/group-${hex}/proto`;
}

/// Envelope for Waku-routed messages (zero SMTP metadata)
export interface WakuEnvelope {
  contentTopic: string;
  payload: string;       // encrypted content (ECIES or symmetric)
  timestamp: number;
  ephemeral: boolean;    // true = don't persist in Waku store
  version: number;
}

/// Create a Waku envelope for A2A messaging
export function createWakuEnvelope(
  fromAgent: string,
  toAgent: string,
  encryptedPayload: string,
  ephemeral = true
): WakuEnvelope {
  return {
    contentTopic: buildDirectMessageTopic(fromAgent, toAgent),
    payload: encryptedPayload,
    timestamp: Date.now(),
    ephemeral,
    version: 1,
  };
}
