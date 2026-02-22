import { NextResponse } from 'next/server';

// Zoho Mail API: https://www.zoho.com/mail/help/api/
// Requires ZOHO_OAUTH_TOKEN and ZOHO_ORG_ID env vars
const ZOHO_API = 'https://mail.zoho.com/api';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      agentName?: string;
      email?: string;
      tbaAddress?: string;
    };

    const { agentName, email, tbaAddress } = body;

    if (!agentName || !email) {
      return NextResponse.json({ error: 'Missing agentName or email' }, { status: 400 });
    }

    const zohoToken = process.env.ZOHO_OAUTH_TOKEN;
    const zohoOrgId = process.env.ZOHO_ORG_ID;

    if (!zohoToken || !zohoOrgId) {
      return NextResponse.json({
        error: 'Zoho not configured — set ZOHO_OAUTH_TOKEN and ZOHO_ORG_ID env vars',
      }, { status: 503 });
    }

    // Step 1: Create account/mailbox via Zoho Mail API
    const createRes = await fetch(`${ZOHO_API}/organization/${zohoOrgId}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${zohoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        primaryEmailAddress: email,
        displayName: agentName,
        password: crypto.randomUUID().slice(0, 16) + 'Aa1!',
        role: 'member',
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({})) as Record<string, any>;
      return NextResponse.json({
        error: errData?.data?.message || `Zoho API returned ${createRes.status}`,
      }, { status: 502 });
    }

    const createData = await createRes.json() as Record<string, any>;
    const accountId = createData?.data?.accountId || createData?.data?.zuid;

    return NextResponse.json({
      status: 'provisioned',
      mailboxId: accountId || 'pending',
      email,
      agentName,
      tbaAddress,
      webmailUrl: `https://mail.zoho.com`,
      imapHost: 'imappro.zoho.com',
      smtpHost: 'smtppro.zoho.com',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Provisioning failed' },
      { status: 500 }
    );
  }
}
