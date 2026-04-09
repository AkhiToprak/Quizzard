import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { wsEmit } from '@/lib/ws-emit';

type Params = { params: Promise<{ id: string; sessionId: string }> };

// POST — join a co-work session
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, sessionId } = await params;

    // Verify session exists and is active
    const session = await db.coWorkSession.findFirst({
      where: { id: sessionId, notebookId, isActive: true },
      select: { id: true, hostId: true },
    });
    if (!session) return notFoundResponse('Session not found or inactive');

    // Verify user is a friend of the host (or is the host)
    if (session.hostId !== userId) {
      const friendship = await db.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: userId, addresseeId: session.hostId },
            { requesterId: session.hostId, addresseeId: userId },
          ],
        },
      });
      if (!friendship) return forbiddenResponse('You must be friends with the host to join');
    }

    // Check if already a participant
    const existingParticipant = await db.coWorkParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (existingParticipant) {
      if (existingParticipant.isActive) {
        return conflictResponse('Already in this session');
      }
      // Re-join: reactivate
      await db.coWorkParticipant.update({
        where: { id: existingParticipant.id },
        data: { isActive: true, leftAt: null },
      });
    } else {
      await db.coWorkParticipant.create({
        data: { sessionId, userId },
      });
    }

    // Real-time broadcast — fetch the user we just (re)joined to enrich the
    // payload, so subscribers can render avatars/names without a follow-up
    // fetch.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true },
    });
    if (user) {
      await wsEmit({
        room: `session:${sessionId}`,
        event: 'cowork:participant_joined',
        data: { sessionId, user },
      });
    }

    return successResponse({ joined: true });
  } catch {
    return internalErrorResponse();
  }
}
