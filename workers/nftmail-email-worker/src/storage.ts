/// <reference types="@cloudflare/workers-types" />

// Constants
export const SIG_BALANCE_OF = '0x70a08231';
export const SIG_GET_IDENTITY = '0x4f5c3a99';
export const MIN_REPUTATION = BigInt('1000000000000000000'); // 1 SURGE
export const SOVEREIGN_TTL_SECONDS = 8 * 24 * 60 * 60; // 8-day decay
export const MAX_INBOX_MESSAGES = 50; // max messages per sovereign inbox
export const AGENT_SUFFIX_RE = /^([a-z0-9-]+)_@nftmail\.box$/i;

// Types and interfaces
export type IdentityState = 'AGENT' | 'HUMAN' | 'NONE';
export type AgentTier = 'executive' | 'standard' | 'swarm';

export interface EmailData {
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: number;
}

export interface MessageMetadata {
  isInternal: boolean;
  isVerified: boolean;
  channel: 'ghost-wire' | 'external' | 'zoho';
  senderAgent?: string;
  recipientAgent?: string;
}

// $SURGE reputation scoring
export interface SurgeScore {
  agent: string;
  score: number;
}

export interface SurgeMetadata {
  participantScores: SurgeScore[];
  averageScore: number;
  maxScore: number;
  priority: number;
}

export interface CalendarEvent {
  id: string;
  type: 'SYNC' | 'TASK' | 'HEARTBEAT';
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  participants: string[];
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  heartbeatVerified?: boolean;
  surgeScore?: number;
  metadata?: Record<string, any>;
}

export interface CalendarInvite {
  type: 'INVITE';
  event: CalendarEvent;
  from: string;
  to: string[];
  message?: string;
}

interface MailStorageConfig {
  backend: 'Zoho' | 'IPFS';
  zohoOrgId: string;
  zohoRefreshToken: string;
  zohoClientId: string;
  zohoClientSecret: string;
  zohoApiDomain: string;
  zohoAccountsDomain?: string;
  zohoAccountId?: string;
  ipfsGateway?: string;
  surgeToken: string;
  quarantineAddress: string;
  ghostRegistry: string;
  inboxKV?: KVNamespace;
  calendarKV?: KVNamespace;
}

export interface AgentStatus {
  agent: string;
  tier: 'executive' | 'standard' | 'swarm';
  surgeScore?: number;
  inbox: {
    count: number;
    unread?: number;
    lastMessage?: {
      id: string;
      from: string;
      subject: string;
      timestamp: number;
      isInternal: boolean;
      isVerified: boolean;
      channel: 'ghost-wire' | 'external' | 'zoho';
    };
  };
  calendar: {
    count: number;
    nextEvent?: CalendarEvent;
    upcomingEvents: CalendarEvent[];
  };
  heartbeat: {
    lastBeat?: number;
    isActive: boolean;
    nextScheduled?: number;
  };
  metadata?: Record<string, any>;
}

export class MailStorageAdapter {
  private config: MailStorageConfig;
  private cachedZohoAccountId?: string;
  private cachedZohoFromAddress?: string;
  private cachedZohoAccessToken?: { token: string; expiresAtMs: number };

  constructor(config: MailStorageConfig) {
    this.config = config;
    this.cachedZohoAccountId = config.zohoAccountId;
  }

  private zohoBaseUrl(): string {
    return this.config.zohoApiDomain.replace(/\/$/, '');
  }

  private zohoMailApiBases(): string[] {
    const configured = this.zohoBaseUrl();
    const candidates = [configured, 'https://mail.zoho.com.au', 'https://mail.zoho.com', 'https://www.zohoapis.com.au'];
    const out: string[] = [];
    for (const c of candidates) {
      const trimmed = String(c || '').trim().replace(/\/$/, '');
      if (trimmed && !out.includes(trimmed)) {
        out.push(trimmed);
      }
    }
    return out;
  }

  private zohoAccountsBaseUrl(): string {
    const domain = this.config.zohoAccountsDomain?.trim();
    if (domain) {
      return domain.replace(/\/$/, '');
    }
    return 'https://accounts.zoho.com.au';
  }

  private async getZohoAccessToken(): Promise<string> {
    const cached = this.cachedZohoAccessToken;
    const now = Date.now();
    if (cached && cached.expiresAtMs - now > 60_000) {
      return cached.token;
    }

    const params = new URLSearchParams({
      refresh_token: this.config.zohoRefreshToken,
      client_id: this.config.zohoClientId,
      client_secret: this.config.zohoClientSecret,
      grant_type: 'refresh_token'
    });

    const url = `${this.zohoAccountsBaseUrl()}/oauth/v2/token?${params.toString()}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (/text\/html/i.test(contentType) || /^\s*</.test(text)) {
      throw new Error(`Zoho OAuth returned HTML (status ${response.status}): ${text.slice(0, 300)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Zoho OAuth non-JSON response (status ${response.status}): ${text.slice(0, 300)}`);
    }

    if (json?.error) {
      throw new Error(`Zoho OAuth error: ${response.status} ${json.error}`);
    }

    const accessToken = String(json?.access_token || '').trim();
    const expiresInSec = Number(json?.expires_in || 3600);
    if (!accessToken) {
      throw new Error(`Zoho OAuth error: missing access_token in ${text.slice(0, 300)}`);
    }

    this.cachedZohoAccessToken = {
      token: accessToken,
      expiresAtMs: Date.now() + Math.max(300, expiresInSec) * 1000
    };

    return accessToken;
  }

  private async getZohoAccountId(): Promise<string> {
    if (this.cachedZohoAccountId) {
      return this.cachedZohoAccountId;
    }

    const accessToken = await this.getZohoAccessToken();

    const response = await fetch(`${this.zohoBaseUrl()}/api/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Zoho accounts error: ${response.status}`);
    }

    const json = await response.json() as any;
    const candidates: any[] = [];

    if (Array.isArray(json)) {
      candidates.push(...json);
    }
    if (json?.data && Array.isArray(json.data)) {
      candidates.push(...json.data);
    }
    if (json?.data && Array.isArray(json.data?.accounts)) {
      candidates.push(...json.data.accounts);
    }
    if (Array.isArray(json?.accounts)) {
      candidates.push(...json.accounts);
    }

    const first = candidates.find((c: any) => typeof c?.accountId === 'string' || typeof c?.accountId === 'number')
      ?? candidates.find((c: any) => typeof c?.accountid === 'string' || typeof c?.accountid === 'number')
      ?? candidates.find((c: any) => typeof c?.id === 'string' || typeof c?.id === 'number');

    const accountId = String(first?.accountId ?? first?.accountid ?? first?.id ?? '').trim();
    if (!accountId) {
      throw new Error('Zoho accounts error: could not determine accountId');
    }

    const primaryFrom = String(first?.primaryEmailAddress ?? first?.mailboxAddress ?? '').trim();
    if (primaryFrom) {
      this.cachedZohoFromAddress = primaryFrom;
    }

    this.cachedZohoAccountId = accountId;
    return accountId;
  }

  private async getZohoFromAddress(): Promise<string> {
    if (this.cachedZohoFromAddress) {
      return this.cachedZohoFromAddress;
    }

    await this.getZohoAccountId();
    if (this.cachedZohoFromAddress) {
      return this.cachedZohoFromAddress;
    }

    throw new Error('Zoho accounts error: could not determine fromAddress');
  }

  async getZohoTokenInfoDebug(): Promise<Response> {
    const accessToken = await this.getZohoAccessToken();

    const candidates = [
      this.zohoAccountsBaseUrl(),
      'https://accounts.zoho.com'
    ];

    let lastStatus = 0;
    let lastText = '';
    let lastContentType = '';

    for (const base of candidates) {
      const url = `${base.replace(/\/$/, '')}/oauth/v2/token/info?access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      lastStatus = response.status;
      lastText = text;
      lastContentType = contentType;

      const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*</.test(text);
      if (response.ok && !looksLikeHtml) {
        return new Response(text, {
          status: response.status,
          headers: { 'content-type': contentType || 'application/json' }
        });
      }

      // If the endpoint doesn't exist on this DC (often returns an HTML 404 page), try the next base.
      if (response.status === 404 || looksLikeHtml) {
        continue;
      }

      // Non-404 JSON error is still informative; return it immediately.
      return new Response(text, {
        status: response.status,
        headers: { 'content-type': contentType || 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({
        error: 'token_info_unavailable',
        status: lastStatus,
        contentType: lastContentType,
        bodyPreview: lastText.slice(0, 500)
      }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }

  async getZohoOrganizationDebug(): Promise<Response> {
    const accessToken = await this.getZohoAccessToken();
    const orgId = this.config.zohoOrgId;

    const urls = [
      `https://mail.zoho.com.au/api/organization/${orgId}/accounts`,
    ];

    const results: Array<{ url: string; status: number; body: string }> = [];

    for (const url of urls) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      const text = await response.text();
      results.push({ url, status: response.status, body: text.slice(0, 500) });

      if (response.ok) {
        let data: any;
        try { data = JSON.parse(text); } catch { data = text; }
        return Response.json({ success: true, url, orgId, data, allAttempts: results });
      }
    }

    return Response.json({ success: false, orgId, attempts: results }, { status: 502 });
  }

  async getAccountsDebug(): Promise<Response> {
    const accessToken = await this.getZohoAccessToken();
    const response = await fetch(`${this.zohoBaseUrl()}/api/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
    });
  }

  private async getReputation(safeAddress: string): Promise<bigint> {
    if (!safeAddress.startsWith('0x')) {
      return BigInt(0);
    }

    const data = SIG_BALANCE_OF + safeAddress.slice(2).padStart(64, '0');
    const response = await fetch('https://rpc.gnosis.gateway.fm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: this.config.surgeToken, data }, 'latest']
      })
    });
    const result = await response.json() as { result?: string };
    return BigInt(result.result || '0');
  }

  private async checkReputation(safeAddress: string): Promise<boolean> {
    const balance = await this.getReputation(safeAddress);
    return balance >= MIN_REPUTATION;
  }

  private async calculateSurgeScore(agent: string): Promise<number> {
    // Normalize $SURGE balance to a 0-100 score
    const SURGE_DECIMALS = 18;
    const MAX_SCORE = 100;
    const MIN_SCORE = 1;

    try {
      // Check if agent is a hex address
      if (/^0x[a-fA-F0-9]{40}$/.test(agent)) {
        const balance = await this.getReputation(agent);
        // Convert to decimal number (1 SURGE = 1e18)
        const surge = Number(balance) / Math.pow(10, SURGE_DECIMALS);
        // Log scale: score = 1 + ln(1 + surge) * 20
        // This gives a score of:
        // 1 SURGE → ~60
        // 5 SURGE → ~72
        // 10 SURGE → ~78
        // 100 SURGE → ~95
        return Math.min(MAX_SCORE, Math.max(MIN_SCORE,
          1 + Math.log(1 + surge) * 20
        ));
      }
    } catch {}

    // Default score for non-hex or failed lookup
    return MIN_SCORE;
  }

  private async calculateEventPriority(event: CalendarEvent): Promise<number> {
    // Get $SURGE scores for all participants
    const scores = await Promise.all(
      event.participants.map(agent => this.calculateSurgeScore(agent))
    );

    // Priority is weighted by:
    // - Highest participant score (50%)
    // - Average score (30%)
    // - Number of participants (20%)
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const participantBonus = Math.min(100, scores.length * 10); // 10 points per participant up to 100

    return (
      maxScore * 0.5 +
      avgScore * 0.3 +
      participantBonus * 0.2
    );
  }

  private async calculateSurgeMetadata(event: CalendarEvent): Promise<SurgeMetadata> {
    const scores = await Promise.all(
      event.participants.map(async agent => ({
        agent,
        score: await this.calculateSurgeScore(agent)
      }))
    );

    return {
      participantScores: scores,
      averageScore: scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
      maxScore: Math.max(...scores.map(s => s.score)),
      priority: await this.calculateEventPriority(event)
    };
  }

  private async getIdentityState(name: string): Promise<IdentityState> {
    // Hash the name for the registry call
    const nameBytes = new TextEncoder().encode(name);
    const hashHex = Array.from(nameBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const data = SIG_GET_IDENTITY + hashHex.padStart(64, '0');
    const response = await fetch('https://rpc.gnosis.gateway.fm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: this.config.ghostRegistry, data }, 'latest']
      })
    });

    const result = await response.json() as { result?: string };
    const stateHex = result.result || '0x0';
    const state = parseInt(stateHex);

    switch (state) {
      case 1: return 'AGENT';
      case 2: return 'HUMAN';
      default: return 'NONE';
    }
  }

  private async pushToZoho(address: string, email: EmailData): Promise<Response> {
    const accessToken = await this.getZohoAccessToken();
    const accountId = await this.getZohoAccountId();
    const fromAddress = await this.getZohoFromAddress();

    const subject = email.subject;
    const content = email.content;
    const response = await fetch(`${this.zohoBaseUrl()}/api/accounts/${accountId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        fromAddress,
        toAddress: `${address}@nftmail.box`,
        subject: `[FWD] ${subject}`,
        content: `From: ${email.from}\nTo: ${email.to}\n\n${content}`
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(`Zoho API error: ${response.status}\n${text}`, { status: response.status });
    }

    return new Response('OK', { status: 200 });
  }

  private generateZohoPassword(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    let b64 = btoa(String.fromCharCode(...bytes));
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return `Nftmail-${b64}!`;
  }

  async provisionMailbox(email: string): Promise<Response> {
    const trimmed = String(email || '').trim();
    if (!trimmed) {
      return new Response('Missing email', { status: 400 });
    }

    // Block underscore suffix: _@ is reserved for agent identities (Ghost-Wire protocol)
    if (AGENT_SUFFIX_RE.test(trimmed)) {
      return Response.json(
        { error: 'forbidden', message: 'The _@ suffix is reserved for agent identities. Human mailboxes cannot use underscore addresses.' },
        { status: 403 }
      );
    }

    const accessToken = await this.getZohoAccessToken();
    const password = this.generateZohoPassword();
    const orgId = this.config.zohoOrgId;

    const url = `https://mail.zoho.com.au/api/organization/${orgId}/accounts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        primaryEmailAddress: trimmed,
        password,
        displayName: trimmed.split('@')[0],
        role: 'member'
      })
    });

    const text = await response.text();
    const ct = response.headers.get('content-type') || 'application/json';

    if (response.ok) {
      return new Response(text || 'Provisioned', { status: 200, headers: { 'content-type': ct } });
    }

    return new Response(`Zoho provisionMailbox error: ${response.status}\n${text}`, {
      status: response.status,
      headers: { 'content-type': ct }
    });
  }

  async createUser(email: string): Promise<Response> {
    // Block underscore suffix: _@ is reserved for agent identities (Ghost-Wire protocol)
    if (AGENT_SUFFIX_RE.test(email)) {
      return Response.json(
        { error: 'forbidden', message: 'The _@ suffix is reserved for agent identities. Human accounts cannot use underscore addresses.' },
        { status: 403 }
      );
    }

    const accessToken = await this.getZohoAccessToken();
    const response = await fetch(`${this.zohoBaseUrl()}/api/organization/${this.config.zohoOrgId}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailAddress: email,
        role: 'user'
      })
    });

    if (!response.ok) {
      return new Response(`Zoho createUser error: ${response.status}`, { status: response.status });
    }

    return new Response('User created', { status: 200 });
  }

  private async forwardHumanIfExists(localPart: string, email: EmailData): Promise<Response | null> {
    const forwarded = await this.pushToZoho(localPart, email);
    if (forwarded.status === 200) {
      return forwarded;
    }
    if (forwarded.status === 404) {
      return null;
    }
    return forwarded;
  }

  private async pushToIPFS(safeAddress: string, email: EmailData): Promise<Response> {
    // Placeholder for IPFS integration
    return new Response('OK', { status: 200 });
  }

  // --- Hybrid Tier Routing ---

  private detectTier(_localPart: string): AgentTier {
    // For MVP: all agent addresses use sovereign KV inbox (swarm tier)
    // Future: check on-chain metadata or registry to determine tier
    // e.g. vault.gno → executive, agent.gno → standard, pico.gno → swarm
    return 'swarm';
  }

  // Detect if an email address is an agent (_@nftmail.box)
  private static parseAgentAddress(addr: string): string | null {
    const m = AGENT_SUFFIX_RE.exec(addr.trim());
    return m ? m[1] : null;
  }

  // Detect A2A: both sender and recipient are agents
  private isA2A(email: EmailData): { sender: string; recipient: string } | null {
    const sender = MailStorageAdapter.parseAgentAddress(email.from);
    const recipient = MailStorageAdapter.parseAgentAddress(email.to);
    if (sender && recipient) {
      return { sender, recipient };
    }
    return null;
  }

  // --- Ghost-Calendar System ---

  private async storeCalendarEvent(event: CalendarEvent): Promise<Response> {
    const kv = this.config.calendarKV;
    if (!kv) {
      return Response.json({ error: 'Calendar KV not configured' }, { status: 500 });
    }

    // Store event in each participant's calendar
    const stores = event.participants.map(async (agent) => {
      const calKey = `calendar:${agent}`;
      const eventsKey = `events:${agent}`;

      // Get existing events
      let events: string[] = [];
      try {
        const raw = await kv.get(eventsKey);
        if (raw) {
          events = JSON.parse(raw);
        }
      } catch { /* fresh calendar */ }

      // Add new event ID
      if (!events.includes(event.id)) {
        events.push(event.id);
      }

      // Store event data and index
      await Promise.all([
        kv.put(`event:${event.id}`, JSON.stringify(event)),
        kv.put(eventsKey, JSON.stringify(events))
      ]);
    });

    await Promise.all(stores);

    return Response.json({
      status: 'scheduled',
      eventId: event.id,
      participants: event.participants,
      type: event.type
    });
  }

  async getAgentCalendar(agentName: string): Promise<Response> {
    const kv = this.config.calendarKV;
    if (!kv) {
      return Response.json({ error: 'Calendar KV not configured' }, { status: 500 });
    }

    const eventsKey = `events:${agentName}`;
    const raw = await kv.get(eventsKey);
    if (!raw) {
      return Response.json({
        agent: agentName,
        events: [],
        nextEvent: null
      });
    }

    let eventIds: string[];
    try {
      eventIds = JSON.parse(raw);
    } catch {
      return Response.json({
        agent: agentName,
        events: [],
        nextEvent: null,
        error: 'Failed to parse events'
      });
    }

    // Fetch all events in parallel
    const events: CalendarEvent[] = [];
    const fetches = eventIds.map(async (id) => {
      const data = await kv.get(`event:${id}`);
      if (data) {
        try {
          const event = JSON.parse(data) as CalendarEvent;
          // Only include future or in-progress events
          if (event.endTime > Date.now() || event.status === 'SCHEDULED') {
            events.push(event);
          }
        } catch { /* skip corrupt */ }
      }
    });
    await Promise.all(fetches);

    // Sort by start time
    events.sort((a, b) => a.startTime - b.startTime);

    // Find next event
    const now = Date.now();
    const nextEvent = events.find(e => 
      e.status === 'SCHEDULED' && 
      e.startTime > now
    );

    return Response.json({
      agent: agentName,
      events,
      nextEvent,
      count: events.length
    });
  }

  async scheduleEvent(invite: CalendarInvite): Promise<Response> {
    const event = invite.event;
    
    // Generate event ID if not provided
    if (!event.id) {
      event.id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    }

    // Calculate $SURGE priority and metadata
    const surgeMetadata = await this.calculateSurgeMetadata(event);
    event.surgeScore = surgeMetadata.priority;
    event.metadata = {
      ...event.metadata,
      ...surgeMetadata
    };

    // Store the event
    const stored = await this.storeCalendarEvent(event);
    if (stored.status !== 200) {
      return stored;
    }

    // Send A2A invites to all participants
    const invites = invite.to.map(agent =>
      this.sendA2A(
        invite.from,
        agent,
        `[CALENDAR] ${event.type}: ${event.title}`,
        JSON.stringify({
          type: 'INVITE',
          event,
          message: invite.message
        })
      )
    );

    await Promise.all(invites);

    return Response.json({
      status: 'scheduled',
      event,
      invitesSent: invite.to.length
    });
  }

  private async pushToSovereignKV(
    agentName: string,
    email: EmailData,
    meta?: Partial<MessageMetadata>
  ): Promise<Response> {
    const kv = this.config.inboxKV;
    if (!kv) {
      return new Response('KV not configured', { status: 500 });
    }

    const indexKey = `index:${agentName}`;

    // Store the individual message with a unique key and TTL
    const msgId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const msgKey = `msg:${agentName}:${msgId}`;

    const metadata: MessageMetadata = {
      isInternal: meta?.isInternal ?? false,
      isVerified: meta?.isVerified ?? false,
      channel: meta?.channel ?? 'external',
      senderAgent: meta?.senderAgent,
      recipientAgent: meta?.recipientAgent ?? agentName
    };

    const envelope = {
      id: msgId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      content: email.content,
      timestamp: email.timestamp,
      receivedAt: Date.now(),
      ...metadata
    };

    // Store message with 8-day TTL (auto-decay)
    await kv.put(msgKey, JSON.stringify(envelope), {
      expirationTtl: SOVEREIGN_TTL_SECONDS
    });

    // Update the inbox index (list of message IDs)
    let index: string[] = [];
    try {
      const existing = await kv.get(indexKey);
      if (existing) {
        index = JSON.parse(existing);
      }
    } catch { /* fresh index */ }

    index.push(msgId);
    // Trim to max messages (oldest first)
    if (index.length > MAX_INBOX_MESSAGES) {
      index = index.slice(-MAX_INBOX_MESSAGES);
    }

    await kv.put(indexKey, JSON.stringify(index), {
      expirationTtl: SOVEREIGN_TTL_SECONDS
    });

    return Response.json({
      status: 'stored',
      tier: 'swarm',
      agent: agentName,
      messageId: msgId,
      decayDays: 8,
      ...metadata
    });
  }

  // A2A Ghost-Wire: agent-to-agent direct KV transfer, zero SMTP cost
  async sendA2A(fromAgent: string, toAgent: string, subject: string, content: string): Promise<Response> {
    const email: EmailData = {
      from: `${fromAgent}_@nftmail.box`,
      to: `${toAgent}_@nftmail.box`,
      subject,
      content,
      timestamp: Date.now()
    };

    return this.pushToSovereignKV(toAgent, email, {
      isInternal: true,
      isVerified: true,
      channel: 'ghost-wire',
      senderAgent: fromAgent,
      recipientAgent: toAgent
    });
  }

  async getAgentStatus(agentName: string): Promise<Response> {
    // Get inbox status
    const inboxKv = this.config.inboxKV;
    if (!inboxKv) {
      return Response.json({ error: 'Inbox KV not configured' }, { status: 500 });
    }

    const indexKey = `index:${agentName}`;
    let messages: any[] = [];
    try {
      const raw = await inboxKv.get(indexKey);
      if (raw) {
        const msgIds = JSON.parse(raw);
        const fetches = msgIds.slice(-5).map(async (id: string) => {
          const data = await inboxKv.get(`msg:${agentName}:${id}`);
          if (data) {
            try { messages.push(JSON.parse(data)); } catch {}
          }
        });
        await Promise.all(fetches);
        messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    } catch {}

    // Get calendar status
    const calendarKv = this.config.calendarKV;
    let events: CalendarEvent[] = [];
    let nextEvent: CalendarEvent | undefined;
    if (calendarKv) {
      try {
        const raw = await calendarKv.get(`events:${agentName}`);
        if (raw) {
          const eventIds = JSON.parse(raw);
          const fetches = eventIds.map(async (id: string) => {
            const data = await calendarKv.get(`event:${id}`);
            if (data) {
              try {
                const event = JSON.parse(data) as CalendarEvent;
                if (event.endTime > Date.now()) {
                  events.push(event);
                }
              } catch {}
            }
          });
          await Promise.all(fetches);
          events.sort((a, b) => a.startTime - b.startTime);
          nextEvent = events.find(e => 
            e.status === 'SCHEDULED' && 
            e.startTime > Date.now()
          );
        }
      } catch {}
    }

    // Build agent status
    const lastMessage = messages[0];
    const now = Date.now();
    const lastBeat = messages.find(m => 
      m.subject?.toLowerCase().includes('heartbeat') ||
      m.type === 'HEARTBEAT'
    )?.timestamp;

    const status: AgentStatus = {
      agent: agentName,
      tier: 'swarm',
      surgeScore: await this.calculateSurgeScore(agentName),
      inbox: {
        count: messages.length,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          from: lastMessage.from,
          subject: lastMessage.subject,
          timestamp: lastMessage.timestamp,
          isInternal: lastMessage.isInternal || false,
          isVerified: lastMessage.isVerified || false,
          channel: lastMessage.channel || 'external'
        } : undefined
      },
      calendar: {
        count: events.length,
        nextEvent,
        upcomingEvents: events.slice(0, 3)
      },
      heartbeat: {
        lastBeat,
        isActive: lastBeat ? (now - lastBeat) < 24 * 60 * 60 * 1000 : false,
        nextScheduled: nextEvent?.type === 'HEARTBEAT' ? nextEvent.startTime : undefined
      }
    };

    return Response.json(status);
  }

  async getInbox(agentName: string): Promise<Response> {
    const kv = this.config.inboxKV;
    if (!kv) {
      return Response.json({ error: 'KV not configured' }, { status: 500 });
    }

    const indexKey = `index:${agentName}`;
    const raw = await kv.get(indexKey);
    if (!raw) {
      return Response.json({ agent: agentName, messages: [], count: 0 });
    }

    let index: string[];
    try {
      index = JSON.parse(raw);
    } catch {
      return Response.json({ agent: agentName, messages: [], count: 0 });
    }

    // Fetch all messages in parallel
    const messages: any[] = [];
    const fetches = index.map(async (msgId) => {
      const msgKey = `msg:${agentName}:${msgId}`;
      const data = await kv.get(msgKey);
      if (data) {
        try { messages.push(JSON.parse(data)); } catch { /* skip corrupt */ }
      }
    });
    await Promise.all(fetches);

    // Sort newest first
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return Response.json({
      agent: agentName,
      tier: 'swarm',
      messages,
      count: messages.length,
      decayDays: 8
    });
  }

  async handleAgentMail(localPart: string, email: EmailData): Promise<Response> {
    const identityName = localPart.slice(0, -1); // Remove trailing _

    // A2A detection: if sender is also an agent (_@nftmail.box), this is Ghost-Wire
    const a2a = this.isA2A(email);
    if (a2a) {
      return this.pushToSovereignKV(identityName, email, {
        isInternal: true,
        isVerified: true,
        channel: 'ghost-wire',
        senderAgent: a2a.sender,
        recipientAgent: a2a.recipient
      });
    }

    const tier = this.detectTier(localPart);

    // Swarm tier: sovereign KV inbox (zero-cost, 8-day decay)
    if (tier === 'swarm') {
      return this.pushToSovereignKV(identityName, email, {
        isInternal: false,
        isVerified: false,
        channel: 'external'
      });
    }

    // Executive/Standard tiers: use Zoho
    const state = await this.getIdentityState(identityName);

    if (state !== 'AGENT') {
      const humanFallback = await this.forwardHumanIfExists(localPart, email);
      if (humanFallback) {
        return humanFallback;
      }
      return new Response('Identity Not Found', { status: 404 });
    }

    const isHexAddress = /^0x[a-fA-F0-9]{40}$/.test(identityName);
    if (isHexAddress) {
      const hasReputation = await this.checkReputation(identityName);
      if (!hasReputation) {
        return this.pushToZoho(this.config.quarantineAddress, {
          ...email,
          subject: `[QUARANTINE] ${email.subject}`
        });
      }
    }

    switch (this.config.backend) {
      case 'Zoho':
        return this.pushToZoho(identityName, email);
      case 'IPFS':
        return this.pushToIPFS(identityName, email);
      default:
        return new Response('Invalid storage backend', { status: 500 });
    }
  }

  async handleHumanMail(localPart: string, email: EmailData): Promise<Response> {
    // Defense in depth: reject any underscore address that leaked into the human path
    if (localPart.endsWith('_')) {
      return Response.json(
        { error: 'forbidden', message: 'Underscore addresses are reserved for agents.' },
        { status: 403 }
      );
    }

    const humanForward = await this.forwardHumanIfExists(localPart, email);
    if (humanForward) {
      return humanForward;
    }

    const state = await this.getIdentityState(localPart);
    if (state === 'HUMAN') {
      return this.pushToZoho(localPart, email);
    }

    return new Response('Identity Not Found', { status: 404 });
  }

  async storeEmail(localPart: string, email: EmailData): Promise<Response> {
    if (localPart.endsWith('_')) {
      return this.handleAgentMail(localPart, email);
    } else {
      return this.handleHumanMail(localPart, email);
    }
  }
}

export default MailStorageAdapter;
