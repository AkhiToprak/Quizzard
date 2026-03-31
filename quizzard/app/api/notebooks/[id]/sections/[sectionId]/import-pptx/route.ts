import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { parsePptxFile } from '@/lib/pptx-parser';
import { textToTipTapJSON } from '@/lib/contentConverter';
import { saveImage } from '@/lib/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type Params = { params: Promise<{ id: string; sectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, sectionId } = await params;

    // Verify notebook ownership
    const notebook = await db.notebook.findFirst({
      where: { id: notebookId, userId },
    });
    if (!notebook) return notFoundResponse('Notebook not found');

    // Verify section belongs to this notebook
    const section = await db.section.findFirst({
      where: { id: sectionId, notebookId },
    });
    if (!section) return notFoundResponse('Section not found in this notebook');

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return badRequestResponse('No file provided');
    }

    // Validate mime type
    if (file.type !== PPTX_MIME) {
      return badRequestResponse('Unsupported file type. Only PPTX files are allowed.');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse('File exceeds maximum size of 50MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const slides = await parsePptxFile(buffer);

    if (slides.length === 0) {
      return badRequestResponse('No slides found in the PPTX file');
    }

    const createdPages = [];

    for (const slide of slides) {
      // Determine sort order
      const maxOrder = await db.page.aggregate({
        where: { sectionId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      // Convert slide text to TipTap JSON
      const content = textToTipTapJSON(slide.textContent) as unknown as Prisma.InputJsonValue;

      // Create the page
      const page = await db.page.create({
        data: {
          sectionId,
          title: slide.title || `Slide ${slide.slideNumber}`,
          content,
          textContent: slide.textContent,
          sortOrder,
          sourceDocId: null,
        },
      });

      // Save images and create PageImage records
      for (const image of slide.images) {
        const { filePath } = await saveImage(page.id, image.fileName, image.buffer);

        await db.pageImage.create({
          data: {
            pageId: page.id,
            fileName: image.fileName,
            filePath,
            fileSize: image.buffer.length,
            mimeType: image.mimeType,
          },
        });
      }

      createdPages.push(page);
    }

    return createdResponse(createdPages);
  } catch (error) {
    console.error('PPTX import error:', error);
    return internalErrorResponse();
  }
}
