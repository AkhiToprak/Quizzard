'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Cowork-socket singleton + React hook.
 *
 * Multiple components in a notebook page (CoWorkBar, CoWorkChat,
 * RemoteCursor overlay, page lock indicator) all want to listen to the same
 * stream of cowork events. Spawning one socket per component would mean N
 * concurrent connections per session per user, which is wasteful.
 *
 * This module exposes a per-session reference-counted singleton:
 *
 *   useCoworkSocket(sessionId)
 *     → connects on first hook mount, disconnects when the last hook unmounts.
 *
 * The singleton handles the presence-token fetch, the join/leave handshake
 * with the ws-server, automatic token refresh, and heartbeat. Consumers
 * receive the live `Socket | null` and can `socket.on(...)` / `socket.emit(...)`
 * directly. There's no need to wrap every event in a React-friendly API —
 * the underlying Socket.IO instance is the most ergonomic surface.
 *
 * Auth: reuses /api/auth/presence-token (the same HMAC token the global
 * presence socket uses). The token already encodes userId; the ws-server
 * trusts the userId from the token and ignores any client-supplied user
 * id when broadcasting room events.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';
const HEARTBEAT_INTERVAL = 30_000;
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 min (TTL is 5 min)

interface SessionEntry {
  socket: Socket | null;
  refCount: number;
  destroying: boolean;
  cleanup: () => void;
  listeners: Set<(socket: Socket) => void>;
}

const sessions = new Map<string, SessionEntry>();

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/presence-token');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.token || null;
  } catch {
    return null;
  }
}

function createSession(sessionId: string): SessionEntry {
  const entry: SessionEntry = {
    socket: null,
    refCount: 0,
    destroying: false,
    cleanup: () => {},
    listeners: new Set(),
  };

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let tokenTimer: ReturnType<typeof setInterval> | null = null;
  let active = true;

  (async () => {
    const token = await fetchToken();
    if (!active || !token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    entry.socket = socket;

    // Join the cowork room as soon as we're connected.
    const sendJoin = () => {
      socket.emit('cowork:join', { sessionId });
    };

    socket.on('connect', sendJoin);

    // If the socket reconnects after a brief drop, re-join the room.
    socket.io.on('reconnect', sendJoin);

    // Wake up any consumers that mounted before the socket finished
    // initialising — they get the live socket immediately.
    for (const listener of entry.listeners) {
      listener(socket);
    }

    heartbeatTimer = setInterval(() => {
      if (socket.connected) socket.emit('heartbeat');
    }, HEARTBEAT_INTERVAL);

    tokenTimer = setInterval(async () => {
      const fresh = await fetchToken();
      if (fresh && socket.connected) {
        socket.auth = { token: fresh };
      }
    }, TOKEN_REFRESH_INTERVAL);
  })();

  entry.cleanup = () => {
    active = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (tokenTimer) clearInterval(tokenTimer);
    if (entry.socket) {
      try {
        entry.socket.emit('cowork:leave', { sessionId });
      } catch {
        // ignore
      }
      entry.socket.disconnect();
      entry.socket = null;
    }
    entry.listeners.clear();
  };

  return entry;
}

/**
 * React hook: subscribe a component to a cowork session's socket.
 *
 * Returns the live `Socket | null` (null until the connection finishes
 * authenticating). Components can `useEffect` on the socket to wire up their
 * own `socket.on(...)` listeners.
 *
 * Pass `null` for sessionId to opt out (component renders with no socket).
 */
export function useCoworkSocket(sessionId: string | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (!sessionId) {
      setSocket(null);
      return;
    }

    let entry = sessions.get(sessionId);
    if (!entry) {
      entry = createSession(sessionId);
      sessions.set(sessionId, entry);
    }
    entry.refCount += 1;

    // If the socket already exists, hand it back immediately. Otherwise
    // register a one-shot listener that fires the moment createSession()
    // finishes its async setup.
    if (entry.socket) {
      setSocket(entry.socket);
    } else {
      const onReady = (s: Socket) => setSocket(s);
      entry.listeners.add(onReady);
    }

    return () => {
      const e = sessions.get(sessionId);
      if (!e) return;
      e.refCount -= 1;
      if (e.refCount <= 0) {
        e.destroying = true;
        e.cleanup();
        sessions.delete(sessionId);
      }
      setSocket(null);
    };
  }, [sessionId]);

  return socket;
}
