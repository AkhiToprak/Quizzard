import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
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
        tags: {
          include: { tag: { select: { name: true } } },
        },
        _count: {
          select: { downloads: true, ratings: true, views: true },
        },
      },
    });

    if (!share) return notFoundResponse('Shared notebook not found');

    // Check visibility — user must have access
    // Direct share (specific recipient): only sender and recipient can access
    if (share.sharedWithId && share.sharedWithId !== userId && share.sharedById !== userId) {
      return notFoundResponse('Shared notebook not found');
    }

    // Specific visibility without sharedWithId should not exist; deny if it does
    if (share.visibility === 'specific' && !share.sharedWithId && share.sharedById !== userId) {
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

    // Compute average rating
    const ratingAgg = await db.notebookRating.aggregate({
      where: { sharedNotebookId: shareId },
      _avg: { value: true },
    });

    // Check if current user has rated or downloaded
    const [userRating, userDownloaded] = await Promise.all([
      db.notebookRating.findUnique({
        where: { sharedNotebookId_userId: { sharedNotebookId: shareId, userId } },
        select: { value: true },
      }),
      db.notebookDownload.findUnique({
        where: { sharedNotebookId_userId: { sharedNotebookId: shareId, userId } },
        select: { id: true },
      }),
    ]);

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
      content: share.content,
      coverImageUrl: share.coverImageUrl,
      images: share.images.map((img) => ({
        id: img.id,
        url: `/api/uploads/shared-images/${img.id}`,
        fileName: img.fileName,
        mimeType: img.mimeType,
      })),
      author: share.sharedBy,
      sharedAt: share.createdAt,
      downloadCount: share._count.downloads,
      ratingCount: share._count.ratings,
      averageRating: Math.round((ratingAgg._avg.value || 0) * 10) / 10,
      viewCount: share._count.views,
      tags: share.tags.map((t) => t.tag.name),
      userRating: userRating?.value || null,
      userDownloaded: !!userDownloaded,
    });
  } catch {
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: { id: true, sharedById: true },
    });

    if (!share) return notFoundResponse('Shared notebook not found');
    if (share.sharedById !== userId)
      return forbiddenResponse('You can only delete your own publications');

    await db.sharedNotebook.delete({ where: { id: shareId } });

    return successResponse({ deleted: true });
  } catch {
    return internalErrorResponse();
  }
}
