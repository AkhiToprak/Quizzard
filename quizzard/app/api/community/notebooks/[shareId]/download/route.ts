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
      select: {
        id: true,
        sharedWithId: true,
        notebook: { select: { name: true, color: true } },
      },
    });

    if (!share || share.sharedWithId !== null) {
      return notFoundResponse('Community notebook not found');
    }

    // Upsert: create download record if it doesn't exist
    await db.notebookDownload.upsert({
      where: {
        sharedNotebookId_userId: { sharedNotebookId: shareId, userId },
      },
      create: { sharedNotebookId: shareId, userId },
      update: {},
    });

    // Create friend activity (only on first download — check if activity already exists)
    const existingActivity = await db.friendActivity.findFirst({
      where: { userId, type: 'downloaded', targetId: shareId },
    });

    if (!existingActivity) {
      await db.friendActivity.create({
        data: {
          userId,
          type: 'downloaded',
          targetName: share.notebook.name,
          targetColor: share.notebook.color,
          targetId: shareId,
        },
      });
    }

    const downloadCount = await db.notebookDownload.count({
      where: { sharedNotebookId: shareId },
    });

    return successResponse({ downloadCount });
  } catch {
    return internalErrorResponse();
  }
}
