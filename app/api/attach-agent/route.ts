import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      workerUrl?: string;
      agentName?: string;
      tbaAddress?: string;
    };

    const { workerUrl, agentName, tbaAddress } = body;

    if (!workerUrl || !agentName) {
      return NextResponse.json({ error: 'Missing workerUrl or agentName' }, { status: 400 });
    }

    // Normalize URL
    let url = workerUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    // Health check — try POST with a ping action, fallback to GET
    const start = Date.now();
    let healthOk = false;
    let responseData: Record<string, any> = {};

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          agentName,
          tbaAddress,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - start;

      if (res.ok) {
        try {
          responseData = await res.json() as Record<string, any>;
        } catch {
          responseData = { body: await res.text() };
        }
        healthOk = true;
        return NextResponse.json({
          status: 'ok',
          latencyMs,
          workerUrl: url,
          agentName,
          response: responseData,
        });
      }

      // Try GET as fallback
      const getRes = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const getLatency = Date.now() - start;

      if (getRes.ok || getRes.status === 405) {
        // 405 = Method Not Allowed means the worker is alive but only accepts POST
        healthOk = true;
        return NextResponse.json({
          status: 'ok',
          latencyMs: getLatency,
          workerUrl: url,
          agentName,
          note: getRes.status === 405 ? 'Worker alive (POST-only)' : 'Worker alive (GET)',
        });
      }

      return NextResponse.json({
        error: `Worker returned ${res.status}: ${res.statusText}`,
        workerUrl: url,
      }, { status: 502 });

    } catch (fetchErr: any) {
      return NextResponse.json({
        error: `Cannot reach worker: ${fetchErr?.message || 'timeout or DNS failure'}`,
        workerUrl: url,
      }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Invalid request' },
      { status: 400 }
    );
  }
}
