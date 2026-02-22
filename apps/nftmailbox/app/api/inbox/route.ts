import { NextRequest, NextResponse } from 'next/server';

const ZOHO_MAIL_API = 'https://mail.zoho.com.au/api';

async function getZohoAccessToken(): Promise<string | null> {
  const existing = process.env.ZOHO_OAUTH_TOKEN;
  if (existing) return existing;

  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!accountsDomain || !refreshToken || !clientId || !clientSecret) return null;

  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('refresh_token', refreshToken);
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);

  const res = await fetch(`https://${accountsDomain}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) return null;
  return (data.access_token as string) || null;
}

interface ZohoMessage {
  messageId: string;
  subject: string;
  sender: string;
  fromAddress: string;
  receivedTime: string;
  summary: string;
  isRead: boolean;
  hasAttachment: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email || !email.endsWith('@nftmail.box')) {
      return NextResponse.json({ error: 'Invalid nftmail.box email' }, { status: 400 });
    }

    const zohoOrgId = process.env.ZOHO_ORG_ID;
    const token = await getZohoAccessToken();
    if (!token || !zohoOrgId) {
      return NextResponse.json({ error: 'Zoho not configured' }, { status: 503 });
    }

    // 1. Find the account ID for this email
    const accountsRes = await fetch(
      `${ZOHO_MAIL_API}/organization/${zohoOrgId}/accounts`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }
    );

    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: `Zoho accounts API returned ${accountsRes.status}` },
        { status: 502 }
      );
    }

    const accountsData = (await accountsRes.json()) as Record<string, any>;
    const accounts = accountsData?.data || [];
    const account = accounts.find(
      (a: any) =>
        a.primaryEmailAddress?.toLowerCase() === email.toLowerCase() ||
        a.mailboxAddress?.toLowerCase() === email.toLowerCase()
    );

    if (!account) {
      // No Zoho mailbox provisioned — return empty inbox (free tier)
      return NextResponse.json({
        messages: [],
        tier: 'free',
        note: 'No Zoho mailbox provisioned. Emails received via Cloudflare Worker routing.',
      });
    }

    const accountId = account.accountId || account.zuid;

    // 2. Fetch inbox messages
    const messagesRes = await fetch(
      `${ZOHO_MAIL_API}/accounts/${accountId}/messages/view?folderId=inbox&limit=50&sortBy=date&sortOrder=desc`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }
    );

    if (!messagesRes.ok) {
      return NextResponse.json(
        { error: `Zoho messages API returned ${messagesRes.status}` },
        { status: 502 }
      );
    }

    const messagesData = (await messagesRes.json()) as Record<string, any>;
    const rawMessages = messagesData?.data || [];

    // 3. Calculate 8-day decay
    const now = Date.now();
    const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

    const messages = rawMessages.map((m: any) => {
      const receivedMs = parseInt(m.receivedTime, 10) || Date.parse(m.receivedTime) || now;
      const ageMs = now - receivedMs;
      const decayPct = Math.min(100, Math.round((ageMs / EIGHT_DAYS_MS) * 100));
      const expiresAt = new Date(receivedMs + EIGHT_DAYS_MS).toISOString();
      const expired = ageMs >= EIGHT_DAYS_MS;

      return {
        messageId: m.messageId,
        subject: m.subject || '(no subject)',
        sender: m.sender || m.fromAddress || 'unknown',
        fromAddress: m.fromAddress || '',
        receivedTime: m.receivedTime,
        summary: m.summary || '',
        isRead: m.flagid === '5' || m.status === '1',
        hasAttachment: m.hasAttachment === 'true' || m.hasAttachment === true,
        decayPct,
        expiresAt,
        expired,
      };
    });

    // Filter out expired messages (8-day decay)
    const activeMessages = messages.filter((m: any) => !m.expired);

    return NextResponse.json({
      messages: activeMessages,
      total: activeMessages.length,
      tier: 'premium',
    });
  } catch (err: any) {
    console.error('Inbox error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}
