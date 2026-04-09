/**
 * Standalone WebSocket presence server.
 * Runs alongside the Next.js app on a separate port (default 3002).
 *
 * Usage:
 *   npx tsx ws-server.ts
 *
 * Environment variables (reads from .env.local):
 *   WS_PORT           – port to listen on (default 3002)
 *   NEXTAUTH_SECRET   – shared secret to verify JWT tokens
 *   DATABASE_URL      – Prisma database URL for lastSeenAt updates
 */

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── Load .env.local ───
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const WS_PORT = parseInt(process.env.WS_PORT || process.env.PORT || '3002', 10);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET;
const HEARTBEAT_INTERVAL = 30_000; // 30s
const HEARTBEAT_TIMEOUT = 65_000; // miss 2 heartbeats → disconnect
const LAST_SEEN_UPDATE_INTERVAL = 60_000; // batch DB updates every 60s

if (!NEXTAUTH_SECRET) {
  console.error('[ws-server] NEXTAUTH_SECRET is not set. Exiting.');
  process.exit(1);
}
if (!WS_INTERNAL_SECRET) {
  console.warn(
    '[ws-server] WS_INTERNAL_SECRET is not set. /emit endpoint will reject all calls.'
  );
}

const db = new PrismaClient();

// ─── JWT verification (next-auth uses a specific HKDF-based approach) ───
// next-auth v4 JWTs are JWE tokens encrypted with A256GCM.
// For simplicity, we'll use a lightweight token approach:
// The client will call a Next.js API to get a short-lived presence token,
// and this server will verify it via a shared HMAC secret.

function verifyPresenceToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [payloadB64, expiresB64, signatureB64] = parts;
    const expected = crypto
      .createHmac('sha256', NEXTAUTH_SECRET!)
      .update(`${payloadB64}.${expiresB64}`)
      .digest('base64url');
    if (expected !== signatureB64) return null;
    const expires = parseInt(Buffer.from(expiresB64, 'base64url').toString(), 10);
    if (Date.now() > expires) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

// ─── Presence state ───
// userId → Set of socket IDs
const onlineUsers = new Map<string, Set<string>>();
// socketId → userId
const socketToUser = new Map<string, string>();
// socketId → last heartbeat timestamp
const lastHeartbeat = new Map<string, number>();
// userId → cached friend IDs
const friendCache = new Map<string, string[]>();

// ─── Cowork session state ───
// sessionId → Map<userId, count> — how many sockets per user are in the room
// (a single user with two tabs open should still count as one participant
// when their first tab disconnects)
const coworkSocketUsers = new Map<string, Map<string, number>>();
// socketId → Set of sessionIds the socket has joined
const socketCoworkSessions = new Map<string, Set<string>>();

function getUserFriends(userId: string): string[] {
  return friendCache.get(userId) || [];
}

async function loadFriends(userId: string): Promise<string[]> {
  const cached = friendCache.get(userId);
  if (cached) return cached;
  try {
    const friendships = await db.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );
    friendCache.set(userId, friendIds);
    // Expire cache after 5 minutes
    setTimeout(() => friendCache.delete(userId), 5 * 60 * 1000);
    return friendIds;
  } catch {
    return [];
  }
}

function getOnlineFriendIds(friendIds: string[]): string[] {
  return friendIds.filter((id) => onlineUsers.has(id));
}

function isOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

// ─── HTTP server + Socket.IO ───
const httpServer = createServer((req, res) => {
  // Debug endpoint — reports env-var state so we can verify the secret
  // matches between Vercel and DigitalOcean. Safe to expose because we
  // only reveal the first 4 chars + length, never the full value.
  if (req.url === '/debug') {
    const secret = WS_INTERNAL_SECRET || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        listeningPort: WS_PORT,
        onlineUsers: onlineUsers.size,
        coworkRooms: coworkSocketUsers.size,
        env: {
          NEXTAUTH_SECRET_set: !!NEXTAUTH_SECRET,
          WS_INTERNAL_SECRET_set: !!WS_INTERNAL_SECRET,
          WS_INTERNAL_SECRET_length: secret.length,
          WS_INTERNAL_SECRET_first4: secret.slice(0, 4),
          NEXTAUTH_URL: process.env.NEXTAUTH_URL || null,
          DATABASE_URL_set: !!process.env.DATABASE_URL,
        },
      })
    );
    return;
  }

  // Health check + presence query endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        onlineCount: onlineUsers.size,
        coworkRooms: coworkSocketUsers.size,
      })
    );
    return;
  }
  // GET /online?ids=id1,id2,id3 — returns which of the given IDs are online
  if (req.url?.startsWith('/online?')) {
    const url = new URL(req.url, `http://localhost:${WS_PORT}`);
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
    const online = ids.filter((id) => isOnline(id));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ online }));
    return;
  }

  // POST /emit — internal webhook from Next.js API routes.
  // Auth: shared HMAC secret in `x-ws-internal-secret` header.
  // Body: { room: string, event: string, data: unknown }
  // Broadcasts the event+data to every socket in the named room.
  if (req.method === 'POST' && req.url === '/emit') {
    const provided = req.headers['x-ws-internal-secret'];
    if (!WS_INTERNAL_SECRET || provided !== WS_INTERNAL_SECRET) {
      console.warn(
        `[ws-server] /emit rejected: ${!WS_INTERNAL_SECRET ? 'no WS_INTERNAL_SECRET on ws-server' : 'secret mismatch with caller'}`
      );
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Cap at 1 MB to prevent abuse
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as {
          room?: string;
          event?: string;
          data?: unknown;
        };
        if (!parsed.room || !parsed.event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing room or event' }));
          return;
        }
        // Look up how many sockets are actually in the room so we can log
        // whether the broadcast will reach anyone.
        const roomSockets = io.sockets.adapter.rooms.get(parsed.room);
        const size = roomSockets ? roomSockets.size : 0;
        console.log(
          `[ws-server] /emit → ${parsed.event} to ${parsed.room} (${size} listener${size === 1 ? '' : 's'})`
        );
        io.to(parsed.room).emit(parsed.event, parsed.data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, listeners: size }));
      } catch (err) {
        console.warn('[ws-server] /emit invalid json:', (err as Error).message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: HEARTBEAT_INTERVAL,
  pingTimeout: HEARTBEAT_TIMEOUT,
});

// ─── Connection handler ───
io.on('connection', async (socket: Socket) => {
  const token = socket.handshake.auth?.token as string;
  if (!token) {
    socket.disconnect(true);
    return;
  }

  const verified = verifyPresenceToken(token);
  if (!verified) {
    socket.emit('auth_error', { message: 'Invalid or expired token' });
    socket.disconnect(true);
    return;
  }

  const { userId } = verified;
  const wasOnline = isOnline(userId);

  // Register connection
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socket.id);
  socketToUser.set(socket.id, userId);
  lastHeartbeat.set(socket.id, Date.now());

  // Load friends and send initial presence
  const friendIds = await loadFriends(userId);
  const onlineFriends = getOnlineFriendIds(friendIds);
  socket.emit('presence:init', { onlineFriendIds: onlineFriends });

  // Notify friends that this user came online (only if wasn't already)
  if (!wasOnline) {
    for (const friendId of friendIds) {
      const friendSockets = onlineUsers.get(friendId);
      if (friendSockets) {
        for (const sid of friendSockets) {
          io.to(sid).emit('presence:update', { online: [userId], offline: [] });
        }
      }
    }
  }

  // Heartbeat from client
  socket.on('heartbeat', () => {
    lastHeartbeat.set(socket.id, Date.now());
  });

  // ─── Cowork: join a session room ───
  // Server trusts the userId from the verified presence token (NOT from the
  // client payload) so an authed user can't impersonate another user.
  // Persistence (DB session check) lives in the Next.js join route — by the
  // time the client emits this, the REST call has already validated they're
  // an active participant.
  socket.on('cowork:join', (payload: { sessionId?: string }) => {
    const sessionId = payload?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') return;

    const room = `session:${sessionId}`;
    socket.join(room);

    // Track membership for cleanup on disconnect
    let sessionsForSocket = socketCoworkSessions.get(socket.id);
    if (!sessionsForSocket) {
      sessionsForSocket = new Set();
      socketCoworkSessions.set(socket.id, sessionsForSocket);
    }
    sessionsForSocket.add(sessionId);

    let usersInSession = coworkSocketUsers.get(sessionId);
    if (!usersInSession) {
      usersInSession = new Map();
      coworkSocketUsers.set(sessionId, usersInSession);
    }
    const prevCount = usersInSession.get(userId) || 0;
    usersInSession.set(userId, prevCount + 1);
  });

  // ─── Cowork: leave a session room ───
  socket.on('cowork:leave', (payload: { sessionId?: string }) => {
    const sessionId = payload?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') return;

    const room = `session:${sessionId}`;
    socket.leave(room);

    const sessionsForSocket = socketCoworkSessions.get(socket.id);
    if (sessionsForSocket) {
      sessionsForSocket.delete(sessionId);
      if (sessionsForSocket.size === 0) {
        socketCoworkSessions.delete(socket.id);
      }
    }

    const usersInSession = coworkSocketUsers.get(sessionId);
    if (usersInSession) {
      const prev = usersInSession.get(userId) || 0;
      if (prev <= 1) {
        usersInSession.delete(userId);
      } else {
        usersInSession.set(userId, prev - 1);
      }
      if (usersInSession.size === 0) {
        coworkSocketUsers.delete(sessionId);
      }
    }
  });

  // ─── Cowork: edit-mode toggle ───
  // The host flips the CoWorkBar "Allow edit" button and the socket relays
  // to everyone (including the sender so the host's own PageEditor picks up
  // the new state from its own listener — single source of truth).
  // No persistence; if the host refreshes, the flag resets to off.
  socket.on(
    'cowork:edit_mode',
    (payload: { sessionId?: string; enabled?: boolean }) => {
      const sessionId = payload?.sessionId;
      if (!sessionId || typeof sessionId !== 'string') return;
      const enabled = !!payload?.enabled;
      io.to(`session:${sessionId}`).emit('cowork:edit_mode', {
        sessionId,
        enabled,
      });
    }
  );

  // ─── Cowork: cursor relay ───
  // Throttling is the client's responsibility; we just relay. Cursors are
  // ephemeral — never persisted to Postgres.
  // Server enriches the payload with the trusted userId so subscribers can
  // attribute the cursor without trusting client input.
  socket.on(
    'cowork:cursor',
    (payload: {
      sessionId?: string;
      pageId?: string;
      x?: number;
      y?: number;
    }) => {
      const sessionId = payload?.sessionId;
      if (!sessionId || typeof sessionId !== 'string') return;
      if (typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
      // Only emit to other sockets in the room (not back to sender).
      socket.to(`session:${sessionId}`).emit('cowork:cursor', {
        sessionId,
        userId,
        pageId: payload.pageId ?? null,
        x: payload.x,
        y: payload.y,
      });
    }
  );

  // Disconnect
  socket.on('disconnect', async () => {
    const uid = socketToUser.get(socket.id);
    if (!uid) return;

    socketToUser.delete(socket.id);
    lastHeartbeat.delete(socket.id);

    // Clean up cowork session memberships
    const sessionsForSocket = socketCoworkSessions.get(socket.id);
    if (sessionsForSocket) {
      for (const sessionId of sessionsForSocket) {
        const usersInSession = coworkSocketUsers.get(sessionId);
        if (usersInSession) {
          const prev = usersInSession.get(uid) || 0;
          if (prev <= 1) {
            usersInSession.delete(uid);
            // The user has no more sockets in this session — broadcast
            // a synthetic "cursor gone" event so peers can hide their
            // cursor overlay immediately.
            io.to(`session:${sessionId}`).emit('cowork:cursor_gone', { sessionId, userId: uid });
          } else {
            usersInSession.set(uid, prev - 1);
          }
          if (usersInSession.size === 0) {
            coworkSocketUsers.delete(sessionId);
          }
        }
      }
      socketCoworkSessions.delete(socket.id);
    }

    const sockets = onlineUsers.get(uid);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(uid);
        // Notify friends this user went offline
        const friends = getUserFriends(uid);
        for (const friendId of friends) {
          const friendSockets = onlineUsers.get(friendId);
          if (friendSockets) {
            for (const sid of friendSockets) {
              io.to(sid).emit('presence:update', { online: [], offline: [uid] });
            }
          }
        }
      }
    }
  });
});

// ─── Periodic lastSeenAt update ───
setInterval(async () => {
  const userIds = Array.from(onlineUsers.keys());
  if (userIds.length === 0) return;
  try {
    await db.user.updateMany({
      where: { id: { in: userIds } },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error('[ws-server] Failed to update lastSeenAt:', err);
  }
}, LAST_SEEN_UPDATE_INTERVAL);

// ─── Start ───
httpServer.listen(WS_PORT, () => {
  console.log(`[ws-server] Presence server listening on port ${WS_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  io.close();
  await db.$disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  io.close();
  await db.$disconnect();
  process.exit(0);
});
