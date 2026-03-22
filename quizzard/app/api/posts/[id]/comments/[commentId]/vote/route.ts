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

// POST — cast or toggle a vote on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId, commentId } = await params;

    const body = await request.json();
    const value = body.value;
    if (value !== 1 && value !== -1) {
      return badRequestResponse('value must be 1 or -1');
    }

    // Verify post + comment
    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, visibility: true },
    });
    if (!post) return notFoundResponse('Post not found');
    if (!(await canUserSeePost(post, userId))) {
      return notFoundResponse('Post not found');
    }

    const comment = await db.postComment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true },
    });
    if (!comment || comment.postId !== postId) {
      return notFoundResponse('Comment not found');
    }

    const existing = await db.commentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    let userVote: number;

    if (existing) {
      if (existing.value === value) {
        await db.commentVote.delete({ where: { id: existing.id } });
        userVote = 0;
      } else {
        await db.commentVote.update({
          where: { id: existing.id },
          data: { value },
        });
        userVote = value;
      }
    } else {
      await db.commentVote.create({
        data: { commentId, userId, value },
      });
      userVote = value;
    }

    const result = await db.commentVote.aggregate({
      where: { commentId },
      _sum: { value: true },
    });
    const voteScore = result._sum.value ?? 0;

    return successResponse({ userVote, voteScore });
  } catch {
    return internalErrorResponse();
  }
}
