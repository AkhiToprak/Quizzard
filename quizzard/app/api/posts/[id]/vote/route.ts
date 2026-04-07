import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { canUserSeePost } from '@/lib/post-visibility';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  badRequestResponse,
  internalErrorResponse,
} from '@/lib/api-response';

// POST — cast or toggle a vote on a post
// Body: { value: 1 | -1 }
// If user already voted with the same value, the vote is removed (toggle off).
// If user voted with the opposite value, the vote is updated.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId } = await params;

    const body = await request.json();
    const value = body.value;
    if (value !== 1 && value !== -1) {
      return badRequestResponse('value must be 1 or -1');
    }

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, visibility: true },
    });

    if (!post) return notFoundResponse('Post not found');

    if (!(await canUserSeePost(post, userId))) {
      return notFoundResponse('Post not found');
    }

    const existing = await db.postVote.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let userVote: number;

    if (existing) {
      if (existing.value === value) {
        // Same vote again → remove it (toggle off)
        await db.postVote.delete({ where: { id: existing.id } });
        userVote = 0;
      } else {
        // Switch vote
        await db.postVote.update({
          where: { id: existing.id },
          data: { value },
        });
        userVote = value;
      }
    } else {
      // New vote
      await db.postVote.create({
        data: { postId, userId, value },
      });
      userVote = value;

      // Notify post author on upvote (don't notify self)
      if (value === 1 && post.authorId !== userId) {
        const voter = await db.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        await db.notification.create({
          data: {
            userId: post.authorId,
            type: 'post_upvote',
            data: {
              fromUserId: userId,
              fromUsername: voter?.username,
              postId,
            },
          },
        });
      }
    }

    // Calculate net score
    const result = await db.postVote.aggregate({
      where: { postId },
      _sum: { value: true },
    });
    const voteScore = result._sum.value ?? 0;

    return successResponse({ userVote, voteScore });
  } catch {
    return internalErrorResponse();
  }
}
