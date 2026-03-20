import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

// POST — toggle like on a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId } = await params;

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) return notFoundResponse('Post not found');

    // Check if already liked
    const existing = await db.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let liked: boolean;

    if (existing) {
      // Unlike
      await db.postLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      // Like
      await db.postLike.create({
        data: { postId, userId },
      });
      liked = true;

      // Notify post author (don't notify self)
      if (post.authorId !== userId) {
        const liker = await db.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        await db.notification.create({
          data: {
            userId: post.authorId,
            type: 'post_like',
            data: {
              fromUserId: userId,
              fromUsername: liker?.username,
              postId,
            },
          },
        });
      }
    }

    const likeCount = await db.postLike.count({ where: { postId } });

    return successResponse({ liked, likeCount });
  } catch {
    return internalErrorResponse();
  }
}
