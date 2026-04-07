import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/api-response';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '4', 10) || 4));

    // Get accepted friend IDs
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

    if (friendIds.length === 0) {
      return successResponse({ activities: [] });
    }

    // Get recent friend activities
    const activities = await db.friendActivity.findMany({
      where: { userId: { in: friendIds } },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, lastSeenAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Determine online status: user is "online" if lastSeenAt is within 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const result = activities.map((a) => ({
      id: a.id,
      userId: a.user.id,
      username: a.user.username,
      avatarUrl: a.user.avatarUrl,
      activity: a.type.charAt(0).toUpperCase() + a.type.slice(1),
      targetName: a.targetName,
      targetColor: a.targetColor,
      targetId: a.targetId,
      timeAgo: formatTimeAgo(a.createdAt),
      online: a.user.lastSeenAt ? a.user.lastSeenAt > twoMinutesAgo : false,
    }));

    return successResponse({ activities: result });
  } catch {
    return internalErrorResponse();
  }
}
