import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '8', 10) || 8));
    const period = searchParams.get('period') || '7d';

    // Calculate the date threshold based on period
    const now = new Date();
    let since: Date;
    switch (period) {
      case '30d':
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get tags weighted by view counts within the period
    // Step 1: Get notebook views within the period
    const recentViews = await db.notebookView.findMany({
      where: { createdAt: { gte: since } },
      select: { sharedNotebookId: true },
    });

    if (recentViews.length === 0) {
      // Fallback: return most-used tags if no recent views
      const fallbackTags = await db.tag.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { sharedNotebookTags: true } },
        },
        orderBy: { sharedNotebookTags: { _count: 'desc' } },
        take: limit,
      });

      return successResponse({
        tags: fallbackTags.map((t) => ({
          id: t.id,
          name: t.name,
          viewCount: t._count.sharedNotebookTags,
        })),
      });
    }

    // Step 2: Count views per notebook
    const viewCounts = new Map<string, number>();
    for (const v of recentViews) {
      viewCounts.set(v.sharedNotebookId, (viewCounts.get(v.sharedNotebookId) || 0) + 1);
    }

    // Step 3: Get tags for those notebooks
    const notebookIds = [...viewCounts.keys()];
    const notebookTags = await db.sharedNotebookTag.findMany({
      where: { sharedNotebookId: { in: notebookIds } },
      select: {
        sharedNotebookId: true,
        tag: { select: { id: true, name: true } },
      },
    });

    // Step 4: Sum view counts per tag
    const tagViewCounts = new Map<string, { id: string; name: string; viewCount: number }>();
    for (const nt of notebookTags) {
      const views = viewCounts.get(nt.sharedNotebookId) || 0;
      const existing = tagViewCounts.get(nt.tag.id);
      if (existing) {
        existing.viewCount += views;
      } else {
        tagViewCounts.set(nt.tag.id, {
          id: nt.tag.id,
          name: nt.tag.name,
          viewCount: views,
        });
      }
    }

    // Step 5: Sort and limit
    const trending = [...tagViewCounts.values()]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);

    return successResponse({ tags: trending });
  } catch {
    return internalErrorResponse();
  }
}
