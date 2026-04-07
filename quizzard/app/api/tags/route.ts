import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase().slice(0, 50);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

    if (!search || search.length === 0) {
      return successResponse({ tags: [] });
    }

    // Find tags matching the search, ordered by popularity (total views on associated notebooks)
    const tags = await db.tag.findMany({
      where: {
        name: { contains: search, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { sharedNotebookTags: true },
        },
      },
      orderBy: {
        sharedNotebookTags: { _count: 'desc' },
      },
      take: limit,
    });

    const result = tags.map((t) => ({
      id: t.id,
      name: t.name,
      usageCount: t._count.sharedNotebookTags,
    }));

    return successResponse({ tags: result });
  } catch {
    return internalErrorResponse();
  }
}
