import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request);

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId');

    // Allow viewing another user's activity via ?userId=. The profile page
    // gates visibility behind !isPrivate, matching how achievements and
    // cosmetics are handled.
    const userId = targetUserId && targetUserId !== authUserId ? targetUserId : authUserId;
    if (!userId) return unauthorizedResponse();

    const days = Math.min(Number(url.searchParams.get('days')) || 365, 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const grouped = await db.activityEvent.groupBy({
      by: ['date'],
      _sum: { count: true },
      where: {
        userId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const data = grouped.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: row._sum.count ?? 0,
    }));

    return successResponse({ data });
  } catch {
    return internalErrorResponse();
  }
}
