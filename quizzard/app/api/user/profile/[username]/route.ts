import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  tooManyRequestsResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const viewerId = await getAuthUserId(request);
    if (!viewerId) return unauthorizedResponse();

    // Rate limit: 30 profile views per minute per user
    const rl = await rateLimit(rateLimitKey('profile:view', request, viewerId), 30, 60 * 1000);
    if (!rl.success) return tooManyRequestsResponse('Too many requests.', rl.retryAfterMs);

    const { username } = await params;

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        age: true,
        location: true,
        school: true,
        lineOfWork: true,
        profilePrivate: true,
        hideAchievements: true,
        createdAt: true,
      },
    });

    if (!user) return notFoundResponse('User not found');

    const isOwnProfile = viewerId === user.id;
    let friendshipStatus: string | null = null;

    if (!isOwnProfile) {
      const friendship = await db.friendship.findFirst({
        where: {
          OR: [
            { requesterId: viewerId, addresseeId: user.id },
            { requesterId: user.id, addresseeId: viewerId },
          ],
        },
        select: { status: true, requesterId: true },
      });

      if (!friendship) {
        friendshipStatus = 'none';
      } else if (friendship.status === 'accepted') {
        friendshipStatus = 'accepted';
      } else if (friendship.status === 'pending') {
        friendshipStatus =
          friendship.requesterId === viewerId ? 'pending_sent' : 'pending_received';
      } else if (friendship.status === 'declined') {
        friendshipStatus = 'none';
      }
    }

    const isFriend = friendshipStatus === 'accepted';

    // Private profile: only show limited info to non-friends
    if (user.profilePrivate && !isFriend && !isOwnProfile) {
      return successResponse({
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        profilePrivate: true,
        friendshipStatus,
      });
    }

    return successResponse({
      ...user,
      friendshipStatus,
    });
  } catch {
    return internalErrorResponse();
  }
}
