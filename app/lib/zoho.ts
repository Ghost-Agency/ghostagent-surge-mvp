/// Zoho Mail Organization API — provision agent email accounts
/// Format: [name]_@nftmail.box
///
/// Required env vars:
///   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
///   ZOHO_ZOID (organization ID: 7006430618)
///   ZOHO_ACCOUNTS_DOMAIN (e.g. accounts.zoho.com.au for AU datacenter)

const ZOHO_ZOID = process.env.ZOHO_ZOID || '7006430618';
const ZOHO_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'accounts.zoho.com.au';
const ZOHO_MAIL_DOMAIN = process.env.ZOHO_MAIL_DOMAIN || 'mail.zoho.com.au';

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZohoAccountResponse {
  status: { code: number; description: string };
  data?: { accountId: string; primaryEmailAddress: string };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN');
  }

  const res = await fetch(`https://${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as ZohoTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

/// Provision a new agent email: [name]_@nftmail.box
export async function provisionAgentEmail(agentName: string): Promise<{
  email: string;
  accountId?: string;
  alreadyExists?: boolean;
}> {
  const email = `${agentName}_@nftmail.box`;
  const displayName = `${agentName} (GhostAgent)`;

  const token = await getAccessToken();

  // Check if account already exists
  const checkRes = await fetch(
    `https://${ZOHO_MAIL_DOMAIN}/api/organization/${ZOHO_ZOID}/accounts?searchWord=${encodeURIComponent(email)}`,
    {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    }
  );

  if (checkRes.ok) {
    const checkData = (await checkRes.json()) as { data?: { accountId: string }[] };
    if (checkData.data && checkData.data.length > 0) {
      return { email, accountId: checkData.data[0].accountId, alreadyExists: true };
    }
  }

  // Create new account
  const createRes = await fetch(
    `https://${ZOHO_MAIL_DOMAIN}/api/organization/${ZOHO_ZOID}/accounts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        primaryEmailAddress: email,
        displayName,
        password: crypto.randomUUID(), // Random password — agents use API, not login
        role: 'member',
      }),
    }
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Zoho account creation failed: ${createRes.status} ${text}`);
  }

  const createData = (await createRes.json()) as ZohoAccountResponse;

  return {
    email,
    accountId: createData.data?.accountId,
  };
}
