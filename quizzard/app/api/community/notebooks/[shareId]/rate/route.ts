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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const body = await request.json().catch(() => ({}));
    const { value } = body as { value?: number };

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
      return badRequestResponse('value must be an integer between 1 and 5');
    }

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: {
        id: true,
        sharedWithId: true,
        notebook: { select: { name: true, color: true } },
      },
    });

    if (!share || share.sharedWithId !== null) {
      return notFoundResponse('Community notebook not found');
    }

    // Check if this is the first rating by this user (for activity tracking)
    const existingRating = await db.notebookRating.findUnique({
      where: {
        sharedNotebookId_userId: { sharedNotebookId: shareId, userId },
      },
    });

    // Upsert the rating
    await db.notebookRating.upsert({
      where: {
        sharedNotebookId_userId: { sharedNotebookId: shareId, userId },
      },
      create: { sharedNotebookId: shareId, userId, value },
      update: { value },
    });

    // Create friend activity only on first rating
    if (!existingRating) {
      await db.friendActivity.create({
        data: {
          userId,
          type: 'rated',
          targetName: share.notebook.name,
          targetColor: share.notebook.color,
          targetId: shareId,
        },
      });
    }

    // Compute aggregates
    const aggregates = await db.notebookRating.aggregate({
      where: { sharedNotebookId: shareId },
      _avg: { value: true },
      _count: { value: true },
    });

    return successResponse({
      averageRating: Math.round((aggregates._avg.value || 0) * 10) / 10,
      ratingCount: aggregates._count.value,
    });
  } catch {
    return internalErrorResponse();
  }
}
