const BACKEND = process.env.BACKEND || 'Zoho';
const ZOHO_API_KEY = process.env.ZOHO_API_KEY;
const IPFS_API_KEY = process.env.IPFS_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SURGE_API_KEY = process.env.SURGE_API_KEY;

class MailStorageAdapter {
  constructor() {
    this.handlers = {
      'Zoho': this.pushToZoho.bind(this),
      'IPFS': this.pushToIPFS.bind(this)
    };
  }

  async pushToZoho(safeAddress, email) {
    const response = await fetch('https://mail.zoho.com/api/accounts/email/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZOHO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ address: safeAddress }],
        subject: email.subject,
        content: email.content
      })
    });
    return response.ok;
  }

  async pushToIPFS(safeAddress, email) {
    // Placeholder IPFS implementation
    console.log('IPFS storage not implemented yet');
    return true;
  }

  async checkReputation(safeAddress) {
    const response = await fetch(`https://api.surge.ai/v1/reputation/${safeAddress}`, {
      headers: { 'Authorization': `Bearer ${SURGE_API_KEY}` }
    });
    const data = await response.json();
    return data.score;
  }

  async store(safeAddress, email) {
    const reputation = await this.checkReputation(safeAddress);
    
    if (reputation < 1) {
      await this.handlers['Zoho'](ADMIN_EMAIL, {
        subject: `[QUARANTINE] Email from ${safeAddress}`,
        content: JSON.stringify(email)
      });
      return { quarantined: true };
    }

    return this.handlers[BACKEND](safeAddress, email);
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { safeAddress, email } = await request.json();
    const adapter = new MailStorageAdapter();
    const result = await adapter.store(safeAddress, email);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
