import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
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

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: { id: true, sharedWithId: true },
    });

    if (!share || share.sharedWithId !== null) {
      return notFoundResponse('Community notebook not found');
    }

    // Upsert: one view per user per notebook
    await db.notebookView.upsert({
      where: {
        sharedNotebookId_userId: { sharedNotebookId: shareId, userId },
      },
      create: { sharedNotebookId: shareId, userId },
      update: {},
    });

    const viewCount = await db.notebookView.count({
      where: { sharedNotebookId: shareId },
    });

    return successResponse({ viewCount });
  } catch {
    return internalErrorResponse();
  }
}
