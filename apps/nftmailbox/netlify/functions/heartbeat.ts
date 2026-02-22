import { schedule } from '@netlify/functions';

const handler = schedule('@hourly', async () => {
  const res = await fetch(
    'https://nftmailbox-cxqzu5nt8-ghost-agents-projects.vercel.app/api/heartbeat'
  );

  if (!res.ok) {
    console.error('Heartbeat failed', res.status);
  }

  return {
    statusCode: 200,
  };
});

export { handler };
