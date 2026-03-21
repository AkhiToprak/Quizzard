import { db } from '@/lib/db';

/**
 * Checks if a user can see a post based on its visibility setting.
 * Used by interaction endpoints (like, comment, poll vote) to enforce access control.
 */
export async function canUserSeePost(
  post: { id: string; authorId: string; visibility: string },
  userId: string
): Promise<boolean> {
  if (post.authorId === userId) return true;
  if (post.visibility === 'public') return true;

  if (post.visibility === 'specific') {
    const visibility = await db.postVisibility.findFirst({
      where: { postId: post.id, userId },
    });
    return !!visibility;
  }

  if (post.visibility === 'friends') {
    const friendship = await db.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, addresseeId: post.authorId },
          { requesterId: post.authorId, addresseeId: userId },
        ],
      },
    });
    return !!friendship;
  }

  return false;
}
