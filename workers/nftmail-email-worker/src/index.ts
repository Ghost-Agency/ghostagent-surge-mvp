/// <reference types="@cloudflare/workers-types" />

import MailStorageAdapter, { CalendarInvite } from './storage';
import { buildDirectMessageTopic, createWakuEnvelope } from './waku';

export interface Env {
  BACKEND: 'KV';
  SURGE_TOKEN: string;
  GHOST_REGISTRY: string;
  INBOX_KV: KVNamespace;
  GHOST_CALENDAR: KVNamespace;
}

interface EmailMessage {
  from: string;
  to: string;
  raw: ReadableStream;
  headers: Headers;
  rawSize: number;
}

interface HttpEmailPayload {
  action?: string;
  email?: string;
  localPart?: string;
  from: string;
  to: string;
  subject: string;
  content: string;
}

const EMAIL_RE = /^([a-z0-9-]+_?)(@nftmail\.box)$/;

function extractLocalPart(email: string): string | null {
  const match = EMAIL_RE.exec(email);
  return match ? match[1] : null;
}

// Open Agency: TLD-based privacy classification
// molt.gno = Glass Box (public audit log, no encryption)
// vault.gno / gno = Black Box (private, encrypted)
const PUBLIC_TLDS = ['molt.gno'];
const PRIVATE_TLDS = ['vault.gno', 'gno', 'nftmail.gno'];

function isPublicAgent(agentName: string, parentTld?: string): boolean {
  if (parentTld) return PUBLIC_TLDS.some(t => parentTld.endsWith(t));
  // Convention: agents ending with _molt are molt.gno agents
  return agentName.endsWith('_molt');
}

function getAgentTld(agentName: string, parentTld?: string): string {
  if (parentTld) return parentTld;
  if (agentName.endsWith('_molt')) return 'molt.gno';
  if (agentName.endsWith('_vault')) return 'vault.gno';
  return 'nftmail.gno';
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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
}

function corsify(response: Response, request: Request): Response {
  const headers = corsHeaders(request);
  const newHeaders = new Headers(response.headers);
  headers.forEach((v, k) => newHeaders.set(k, v));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext) {
    const storage = new MailStorageAdapter({
      backend: env.BACKEND,
      surgeToken: env.SURGE_TOKEN,
      ghostRegistry: env.GHOST_REGISTRY,
      inboxKV: env.INBOX_KV,
      calendarKV: env.GHOST_CALENDAR
    });

    const to = message.to;
    const localPart = extractLocalPart(to);
    
    if (!localPart) {
      return new Response('Invalid email format', { status: 400 });
    }

    const content = await new Response(message.raw).text();

    return storage.storeEmail(localPart, {
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject') || '',
      content,
      timestamp: Date.now()
    });
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    try {
      const storage = new MailStorageAdapter({
        backend: env.BACKEND,
        surgeToken: env.SURGE_TOKEN,
        ghostRegistry: env.GHOST_REGISTRY,
        inboxKV: env.INBOX_KV,
        calendarKV: env.GHOST_CALENDAR
      });

      if (request.method === 'POST') {
        const email = await request.json() as HttpEmailPayload;
        let result: Response;

        if (email.action === 'getInbox') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return corsify(new Response('Missing agent name (localPart or email)', { status: 400 }), request);
          }
          result = await storage.getInbox(agent);
          return corsify(result, request);
        }

        // UI Integration: Get agent status (inbox + calendar + heartbeat)
        if (email.action === 'getAgentStatus') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return corsify(new Response('Missing agent name (localPart or email)', { status: 400 }), request);
          }
          result = await storage.getAgentStatus(agent);
          return corsify(result, request);
        }

        // Ghost-Calendar actions
        if (email.action === 'getCalendar') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return corsify(new Response('Missing agent name (localPart or email)', { status: 400 }), request);
          }
          result = await storage.getAgentCalendar(agent);
          return corsify(result, request);
        }

        if (email.action === 'scheduleEvent') {
          const invite = email as any as { invite: CalendarInvite };
          if (!invite?.invite?.event || !invite?.invite?.from || !invite?.invite?.to) {
            return corsify(Response.json({ error: 'Missing invite data' }, { status: 400 }), request);
          }
          result = await storage.scheduleEvent(invite.invite);
          return corsify(result, request);
        }

        // A2A Ghost-Wire: agent-to-agent direct messaging (zero SMTP cost)
        if (email.action === 'sendA2A') {
          const fromAgent = (email as any).fromAgent || '';
          const toAgent = (email as any).toAgent || '';
          if (!fromAgent || !toAgent) {
            return corsify(Response.json({ error: 'Missing fromAgent or toAgent' }, { status: 400 }), request);
          }
          result = await storage.sendA2A(fromAgent, toAgent, email.subject || '', email.content || '');
          return corsify(result, request);
        }

        // Zero-Knowledge Metadata: Waku gossip topic routing
        if (email.action === 'wakuRoute') {
          const fromAgent = (email as any).fromAgent || '';
          const toAgent = (email as any).toAgent || '';
          if (!fromAgent || !toAgent) {
            return corsify(Response.json({ error: 'Missing fromAgent or toAgent' }, { status: 400 }), request);
          }
          const topic = buildDirectMessageTopic(fromAgent, toAgent);
          const envelope = createWakuEnvelope(fromAgent, toAgent, email.content || '', true);
          // Store in KV as well for offline retrieval
          await storage.sendA2A(fromAgent, toAgent, email.subject || '', email.content || '');
          return corsify(Response.json({ topic, envelope, stored: true }), request);
        }

        // Privacy Toggle: set privacy state for a .gno name
        if (email.action === 'setPrivacy') {
          const agent = email.localPart || '';
          const privacyEnabled = (email as any).privacyEnabled;
          if (!agent || typeof privacyEnabled !== 'boolean') {
            return corsify(Response.json({ error: 'Missing localPart or privacyEnabled' }, { status: 400 }), request);
          }
          await env.INBOX_KV.put(`privacy:${agent}`, JSON.stringify({ privacyEnabled, updatedAt: Date.now() }));
          return corsify(Response.json({ status: 'ok', privacyEnabled }), request);
        }

        // Privacy Toggle: get privacy state for a .gno name
        if (email.action === 'getPrivacy') {
          const agent = email.localPart || '';
          if (!agent) {
            return corsify(Response.json({ error: 'Missing localPart' }, { status: 400 }), request);
          }
          const raw = await env.INBOX_KV.get(`privacy:${agent}`);
          if (!raw) {
            return corsify(Response.json({ privacyEnabled: false }), request);
          }
          try {
            const data = JSON.parse(raw);
            return corsify(Response.json({ privacyEnabled: data.privacyEnabled ?? false }), request);
          } catch {
            return corsify(Response.json({ privacyEnabled: false }), request);
          }
        }

        // Open Agency: resolve agent TLD and public status
        if (email.action === 'getAgentTLD') {
          const agent = email.localPart || '';
          const parentTld = (email as any).parentTld || '';
          if (!agent) {
            return corsify(Response.json({ error: 'Missing localPart' }, { status: 400 }), request);
          }
          const tld = getAgentTld(agent, parentTld);
          const isPublic = isPublicAgent(agent, parentTld);
          return corsify(Response.json({ agent, tld, isPublic, classification: isPublic ? 'Glass Box' : 'Black Box' }), request);
        }

        // Open Agency: get public audit log for a molt.gno agent
        if (email.action === 'getPublicAuditLog') {
          const agent = email.localPart || '';
          if (!agent) {
            return corsify(Response.json({ error: 'Missing localPart' }, { status: 400 }), request);
          }
          const raw = await env.INBOX_KV.get(`audit:${agent}`);
          const entries: AuditEntry[] = raw ? JSON.parse(raw) : [];
          // Also get molt transitions
          const transRaw = await env.INBOX_KV.get(`molt-log:${agent}`);
          const transitions: MoltTransition[] = transRaw ? JSON.parse(transRaw) : [];
          return corsify(Response.json({ agent, isPublic: isPublicAgent(agent), entries, transitions }), request);
        }

        // Open Agency: Molt to Private — transition agent from molt.gno to vault.gno
        if (email.action === 'moltToPrivate') {
          const agent = email.localPart || '';
          const signature = (email as any).signature || '';
          const newTld = (email as any).newTld || 'vault.gno';
          if (!agent) {
            return corsify(Response.json({ error: 'Missing agent name' }, { status: 400 }), request);
          }
          if (!signature) {
            return corsify(Response.json({ error: 'Missing Safe signature — molt transition requires owner auth' }, { status: 403 }), request);
          }
          // Record the molt transition
          const transition: MoltTransition = {
            agent,
            fromTld: getAgentTld(agent),
            toTld: newTld,
            block: Date.now(), // placeholder — real impl reads on-chain block
            timestamp: Date.now(),
            status: `Public Audit Log Terminated. Agent is now Sovereign.`,
          };
          const transRaw = await env.INBOX_KV.get(`molt-log:${agent}`);
          const transitions: MoltTransition[] = transRaw ? JSON.parse(transRaw) : [];
          transitions.push(transition);
          await env.INBOX_KV.put(`molt-log:${agent}`, JSON.stringify(transitions));
          // Flip privacy to enabled (Black Box)
          await env.INBOX_KV.put(`privacy:${agent}`, JSON.stringify({ privacyEnabled: true, updatedAt: Date.now(), molted: true }));
          return corsify(Response.json({ status: 'molted', transition }), request);
        }

        // Sovereign Kill-Switch: purge all inbox data for an agent
        if (email.action === 'purgeInbox') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          const signature = (email as any).signature || '';
          if (!agent) {
            return corsify(Response.json({ error: 'Missing agent name' }, { status: 400 }), request);
          }
          if (!signature) {
            return corsify(Response.json({ error: 'Missing Safe signature — sovereign burn requires owner auth' }, { status: 403 }), request);
          }
          result = await storage.purgeInbox(agent);
          return corsify(result, request);
        }

        const localPart = extractLocalPart(email.to);
        
        if (!localPart) {
          return corsify(new Response('Invalid email format', { status: 400 }), request);
        }

        // Store email — and dual-write to public audit log for molt.gno agents
        const emailPayload = {
          from: email.from,
          to: email.to,
          subject: email.subject,
          content: email.content,
          timestamp: Date.now()
        };
        result = await storage.storeEmail(localPart, emailPayload);

        // Glass Box: if this is a molt.gno agent, append to public audit log
        if (isPublicAgent(localPart)) {
          const contentHash = await sha256Hex(JSON.stringify(emailPayload));
          const entry: AuditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: email.from,
            to: email.to,
            subject: email.subject,
            content: email.content,
            timestamp: emailPayload.timestamp,
            contentHash,
            verified: true,
          };
          const auditRaw = await env.INBOX_KV.get(`audit:${localPart}`);
          const auditLog: AuditEntry[] = auditRaw ? JSON.parse(auditRaw) : [];
          auditLog.push(entry);
          await env.INBOX_KV.put(`audit:${localPart}`, JSON.stringify(auditLog));
        }

        return corsify(result, request);
      }
      return corsify(new Response('Method not allowed', { status: 405 }), request);
    } catch (err: any) {
      return corsify(
        Response.json(
          { error: err?.message || String(err), stack: err?.stack?.split('\n').slice(0, 5) },
          { status: 500 }
        ),
        request
      );
    }
  }
};
