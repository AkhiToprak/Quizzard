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

const WS_PORT = parseInt(process.env.WS_PORT || '3002', 10);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const HEARTBEAT_INTERVAL = 30_000; // 30s
const HEARTBEAT_TIMEOUT = 65_000; // miss 2 heartbeats → disconnect
const LAST_SEEN_UPDATE_INTERVAL = 60_000; // batch DB updates every 60s

if (!NEXTAUTH_SECRET) {
  console.error('[ws-server] NEXTAUTH_SECRET is not set. Exiting.');
  process.exit(1);
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
  // Health check + presence query endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', onlineCount: onlineUsers.size }));
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

  // Disconnect
  socket.on('disconnect', async () => {
    const uid = socketToUser.get(socket.id);
    if (!uid) return;

    socketToUser.delete(socket.id);
    lastHeartbeat.delete(socket.id);

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
