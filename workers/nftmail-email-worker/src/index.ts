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

        if (email.action === 'getInbox') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return new Response('Missing agent name (localPart or email)', { status: 400 });
          }
          return storage.getInbox(agent);
        }

        // UI Integration: Get agent status (inbox + calendar + heartbeat)
        if (email.action === 'getAgentStatus') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return new Response('Missing agent name (localPart or email)', { status: 400 });
          }
          return storage.getAgentStatus(agent);
        }

        // Ghost-Calendar actions
        if (email.action === 'getCalendar') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          if (!agent) {
            return new Response('Missing agent name (localPart or email)', { status: 400 });
          }
          return storage.getAgentCalendar(agent);
        }

        if (email.action === 'scheduleEvent') {
          const invite = email as any as { invite: CalendarInvite };
          if (!invite?.invite?.event || !invite?.invite?.from || !invite?.invite?.to) {
            return Response.json({ error: 'Missing invite data' }, { status: 400 });
          }
          return storage.scheduleEvent(invite.invite);
        }

        // A2A Ghost-Wire: agent-to-agent direct messaging (zero SMTP cost)
        if (email.action === 'sendA2A') {
          const fromAgent = (email as any).fromAgent || '';
          const toAgent = (email as any).toAgent || '';
          if (!fromAgent || !toAgent) {
            return Response.json({ error: 'Missing fromAgent or toAgent' }, { status: 400 });
          }
          return storage.sendA2A(fromAgent, toAgent, email.subject || '', email.content || '');
        }

        // Zero-Knowledge Metadata: Waku gossip topic routing
        if (email.action === 'wakuRoute') {
          const fromAgent = (email as any).fromAgent || '';
          const toAgent = (email as any).toAgent || '';
          if (!fromAgent || !toAgent) {
            return Response.json({ error: 'Missing fromAgent or toAgent' }, { status: 400 });
          }
          const topic = buildDirectMessageTopic(fromAgent, toAgent);
          const envelope = createWakuEnvelope(fromAgent, toAgent, email.content || '', true);
          // Store in KV as well for offline retrieval
          await storage.sendA2A(fromAgent, toAgent, email.subject || '', email.content || '');
          return Response.json({ topic, envelope, stored: true });
        }

        // Sovereign Kill-Switch: purge all inbox data for an agent
        if (email.action === 'purgeInbox') {
          const agent = email.localPart || email.email?.split('@')[0] || '';
          const signature = (email as any).signature || '';
          if (!agent) {
            return Response.json({ error: 'Missing agent name' }, { status: 400 });
          }
          if (!signature) {
            return Response.json({ error: 'Missing Safe signature — sovereign burn requires owner auth' }, { status: 403 });
          }
          return storage.purgeInbox(agent);
        }

        const localPart = extractLocalPart(email.to);
        
        if (!localPart) {
          return new Response('Invalid email format', { status: 400 });
        }

        return storage.storeEmail(localPart, {
          from: email.from,
          to: email.to,
          subject: email.subject,
          content: email.content,
          timestamp: Date.now()
        });
      }
      return new Response('Method not allowed', { status: 405 });
    } catch (err: any) {
      return Response.json(
        { error: err?.message || String(err), stack: err?.stack?.split('\n').slice(0, 5) },
        { status: 500 }
      );
    }
  }
};
