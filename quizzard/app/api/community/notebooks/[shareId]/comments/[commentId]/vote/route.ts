import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

type Params = { params: Promise<{ shareId: string; commentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId, commentId } = await params;

    const comment = await db.notebookComment.findUnique({
      where: { id: commentId },
      select: { id: true, sharedNotebookId: true },
    });
    if (!comment || comment.sharedNotebookId !== shareId) {
      return notFoundResponse('Comment not found');
    }

    const body = await request.json().catch(() => ({}));
    const { value } = body as { value?: number };

    if (value !== 1 && value !== -1 && value !== 0) {
      return badRequestResponse('value must be 1, -1, or 0');
    }

    if (value === 0) {
      // Remove vote
      await db.notebookCommentVote.deleteMany({
        where: { commentId, userId },
      });
    } else {
      // Upsert vote
      await db.notebookCommentVote.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId, value },
        update: { value },
      });
    }

    // Return updated vote counts
    const votes = await db.notebookCommentVote.findMany({
      where: { commentId },
      select: { value: true, userId: true },
    });
    const upvotes = votes.filter((v) => v.value === 1).length;
    const downvotes = votes.filter((v) => v.value === -1).length;
    const userVote = votes.find((v) => v.userId === userId)?.value || 0;

    return successResponse({
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      userVote,
    });
  } catch {
    return internalErrorResponse();
  }
}
