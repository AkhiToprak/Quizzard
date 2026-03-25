import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

type Params = { params: Promise<{ shareId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      include: {
        notebook: {
          select: {
            id: true,
            name: true,
            subject: true,
            color: true,
            description: true,
            _count: { select: { sections: true } },
            sections: {
              select: {
                id: true,
                title: true,
                sortOrder: true,
                _count: { select: { pages: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        sharedBy: {
          select: { id: true, username: true, avatarUrl: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!share) return notFoundResponse('Shared notebook not found');

    // Check visibility — user must have access
    if (share.sharedWithId && share.sharedWithId !== userId && share.sharedById !== userId) {
      return notFoundResponse('Shared notebook not found');
    }

    if (share.visibility === 'friends' && share.sharedById !== userId) {
      const friendship = await db.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: userId, addresseeId: share.sharedById },
            { requesterId: share.sharedById, addresseeId: userId },
          ],
        },
      });
      if (!friendship) return notFoundResponse('Shared notebook not found');
    }

    return successResponse({
      shareId: share.id,
      notebookId: share.notebook.id,
      name: share.notebook.name,
      subject: share.notebook.subject,
      color: share.notebook.color,
      notebookDescription: share.notebook.description,
      sectionCount: share.notebook._count.sections,
      sections: share.notebook.sections.map((s) => ({
        id: s.id,
        title: s.title,
        pageCount: s._count.pages,
      })),
      shareType: share.type,
      visibility: share.visibility,
      title: share.title,
      description: share.description,
      images: share.images.map((img) => ({
        id: img.id,
        url: `/api/uploads/shared-images/${img.id}`,
        fileName: img.fileName,
        mimeType: img.mimeType,
      })),
      author: share.sharedBy,
      sharedAt: share.createdAt,
    });
  } catch {
    return internalErrorResponse();
  }
}
