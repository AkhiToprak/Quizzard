import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/api-response';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

type Params = { params: Promise<{ imageId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { imageId } = await params;

    const image = await db.pageImage.findFirst({
      where: {
        id: imageId,
        page: {
          section: {
            notebook: { userId },
          },
        },
      },
    });

    if (!image) return notFoundResponse('Image not found');

    // Defense-in-depth: ensure resolved path is still within uploads directory
    const resolvedPath = path.resolve(image.filePath);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) && resolvedPath !== UPLOADS_DIR) {
      return notFoundResponse('Image not found');
    }

    const buffer = await fs.readFile(resolvedPath);

    return new Response(buffer, {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return internalErrorResponse();
  }
}
