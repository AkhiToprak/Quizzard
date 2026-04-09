/**
 * Server-side helper for broadcasting events to the standalone ws-server.
 *
 * The ws-server (quizzard/ws-server.ts) exposes an internal `POST /emit`
 * endpoint protected by a shared secret (`WS_INTERNAL_SECRET`). Next.js API
 * routes call this helper after they've successfully written to Postgres,
 * and the ws-server fans out the event to all sockets in the matching room.
 *
 * Why HTTP instead of giving ws-server its own Prisma client?
 * - Single Postgres writer (Next.js routes) — no double-write race
 * - ws-server stays small and dumb (just a relay)
 * - No second Prisma client memory bloat
 * - Easier to deploy ws-server independently
 *
 * Failures are logged but never thrown — a transient ws-server outage
 * should never break a REST endpoint that already succeeded in Postgres.
 * Worst case: clients miss a real-time event but get it on next refresh.
 */

const WS_INTERNAL_URL =
  process.env.WS_INTERNAL_URL || 'http://localhost:3002';
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || '';

export interface WsEmitPayload {
  /** Socket.IO room to broadcast to. For cowork: `session:<sessionId>`. */
  room: string;
  /** Event name, e.g. `cowork:message`, `cowork:page_locked`. */
  event: string;
  /** Arbitrary serializable payload. */
  data: unknown;
}

/**
 * Fire-and-forget emit. Returns void; never throws.
 * Uses a 2 second timeout so a hung ws-server doesn't tie up an API route.
 */
export async function wsEmit(payload: WsEmitPayload): Promise<void> {
  if (!WS_INTERNAL_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ws-emit] WS_INTERNAL_SECRET is not set; skipping broadcast.');
    }
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${WS_INTERNAL_URL}/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ws-internal-secret': WS_INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[ws-emit] ws-server responded ${res.status} for ${payload.event}`);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn(`[ws-emit] timeout broadcasting ${payload.event}`);
    } else {
      console.warn(`[ws-emit] failed to broadcast ${payload.event}:`, (err as Error).message);
    }
  } finally {
    clearTimeout(timeout);
  }
}
