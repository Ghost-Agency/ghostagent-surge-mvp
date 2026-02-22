import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);

  return NextResponse.json({
    host: url.host,
    nextPublicPrivyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? null,
    nextPublicPrivyAppIdTrimmed: process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? null,
    hasPrivySecret: Boolean(process.env.PRIVY_APP_SECRET),
  });
}
