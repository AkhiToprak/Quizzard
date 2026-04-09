import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

/**
 * GET /api/debug/cowork-emit-test?room=<room>
 *
 * Hits the ws-server's `/emit` webhook with a synthetic test event and
 * returns the complete response (status, text body, timing, env-var
 * check) so we can see exactly where the REST→WS broadcast chain is
 * breaking down.
 *
 * Auth: any authenticated user. This is safe to expose because:
 *   - It only POSTs to our own internal webhook
 *   - The event name is a dedicated `debug:ping` that clients are
 *     not subscribed to — no side effects
 *   - Worst case: a logged-in user spams their own test broadcasts,
 *     which the ws-server rate limits at the TCP level.
 *
 * Usage:
 *   curl -b "cookie-jar" https://notemage.app/api/debug/cowork-emit-test
 *   curl -b "cookie-jar" https://notemage.app/api/debug/cowork-emit-test?room=session:abc123
 *
 * Or just paste the URL into a browser tab while logged in.
 */
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request);
  if (!userId) return unauthorizedResponse();

  const room = request.nextUrl.searchParams.get('room') || 'session:debug-test';

  const WS_INTERNAL_URL =
    process.env.WS_INTERNAL_URL || 'http://localhost:3002';
  const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || '';

  const normalizedUrl = WS_INTERNAL_URL.replace(/\/+$/, ''); // strip trailing slashes
  const emitUrl = `${normalizedUrl}/emit`;

  const envCheck = {
    WS_INTERNAL_URL_set: !!process.env.WS_INTERNAL_URL,
    WS_INTERNAL_URL_value: WS_INTERNAL_URL,
    WS_INTERNAL_URL_normalized: normalizedUrl,
    WS_INTERNAL_URL_had_trailing_slash: WS_INTERNAL_URL !== normalizedUrl,
    WS_INTERNAL_SECRET_set: !!WS_INTERNAL_SECRET,
    WS_INTERNAL_SECRET_length: WS_INTERNAL_SECRET.length,
    WS_INTERNAL_SECRET_first4: WS_INTERNAL_SECRET.slice(0, 4),
    NEXT_PUBLIC_WS_URL_set: !!process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_WS_URL_value: process.env.NEXT_PUBLIC_WS_URL || null,
  };

  if (!WS_INTERNAL_SECRET) {
    return NextResponse.json({
      ok: false,
      stage: 'env',
      error:
        'WS_INTERNAL_SECRET is not set on this Vercel environment. The REST→WS broadcast chain cannot work until it is set to the same value as on the ws-server.',
      envCheck,
    });
  }

  const payload = {
    room,
    event: 'debug:ping',
    data: {
      from: 'cowork-emit-test',
      userId,
      ts: new Date().toISOString(),
    },
  };

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(emitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ws-internal-secret': WS_INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const elapsed = Date.now() - started;
    const bodyText = await res.text();

    return NextResponse.json({
      ok: res.ok,
      stage: 'fetch',
      request: {
        url: emitUrl,
        method: 'POST',
        payload,
      },
      response: {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        bodyText,
        elapsedMs: elapsed,
      },
      hint:
        res.status === 401
          ? 'WS_INTERNAL_SECRET does not match the value configured on the ws-server. Generate a new one with `openssl rand -hex 32` and set it IDENTICALLY on both Vercel and DigitalOcean App Platform, then redeploy both.'
          : res.status === 404
            ? 'The ws-server is reachable but does not have a POST /emit handler. It is running old code — redeploy the ws-server on DigitalOcean.'
            : res.ok
              ? 'Broadcast delivered. Check the ws-server Runtime Logs on DigitalOcean for the corresponding `[ws-server] /emit → debug:ping` line — it should show `(0 listeners)` for the fake "session:debug-test" room.'
              : `Unexpected status. Check the ws-server runtime logs.`,
      envCheck,
    });
  } catch (err) {
    const elapsed = Date.now() - started;
    const name = (err as Error).name;
    const message = (err as Error).message;

    return NextResponse.json({
      ok: false,
      stage: 'fetch',
      request: { url: emitUrl, method: 'POST', payload },
      error: {
        name,
        message,
        elapsedMs: elapsed,
      },
      hint:
        name === 'AbortError'
          ? 'Fetch timed out after 5 seconds. The ws-server is not responding at that URL. Double-check WS_INTERNAL_URL matches your DigitalOcean App URL and that the service is running.'
          : message.toLowerCase().includes('enotfound')
            ? 'DNS resolution failed. WS_INTERNAL_URL is pointing at a hostname that does not exist.'
            : message.toLowerCase().includes('econnrefused')
              ? 'Connection refused. ws-server is not listening on that URL or port.'
              : `Unknown network error: ${message}`,
      envCheck,
    });
  }
}
