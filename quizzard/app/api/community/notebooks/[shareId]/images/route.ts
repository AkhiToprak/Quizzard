import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveImage } from '@/lib/storage';
import {
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
} from '@/lib/api-response';

type Params = { params: Promise<{ shareId: string }> };

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 10;

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      include: { _count: { select: { images: true } } },
    });

    if (!share) return notFoundResponse('Shared notebook not found');
    if (share.sharedById !== userId) return forbiddenResponse('You do not own this share');

    if (share._count.images >= MAX_IMAGES) {
      return badRequestResponse(`Maximum ${MAX_IMAGES} images allowed`);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return badRequestResponse('No file provided');
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return badRequestResponse('Invalid file type. Allowed: PNG, JPEG, GIF, WebP');
    }

    if (file.size > MAX_SIZE) {
      return badRequestResponse('File too large. Maximum size is 5MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filePath } = await saveImage(`shared-${shareId}`, file.name, buffer);

    const image = await db.sharedNotebookImage.create({
      data: {
        sharedNotebookId: shareId,
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        sortOrder: share._count.images,
      },
    });

    const imageUrl = `/api/uploads/shared-images/${image.id}`;

    // If this is a cover image, set it on the shared notebook
    const isCover = formData.get('isCover');
    if (isCover === 'true') {
      await db.sharedNotebook.update({
        where: { id: shareId },
        data: { coverImageUrl: imageUrl },
      });
    }

    return createdResponse({
      id: image.id,
      fileName: image.fileName,
      fileSize: image.fileSize,
      mimeType: image.mimeType,
      url: imageUrl,
      sortOrder: image.sortOrder,
    });
  } catch {
    return internalErrorResponse();
  }
}
