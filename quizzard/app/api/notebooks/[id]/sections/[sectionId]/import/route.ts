import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { extractText, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/fileProcessing';
import { textToTipTapJSON, htmlToTipTapJSON } from '@/lib/contentConverter';
import { saveImage } from '@/lib/storage';
import mammoth from 'mammoth';

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
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return badRequestResponse(
        'Unsupported file type. Allowed: PDF, DOCX, TXT, MD'
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse('File exceeds maximum size of 10MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract TipTap JSON content
    let content: object;
    const isDocx =
      file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isDocx) {
      // For DOCX, use mammoth to get HTML then convert to TipTap JSON for rich formatting
      const htmlResult = await mammoth.convertToHtml({ buffer });
      content = htmlToTipTapJSON(htmlResult.value);
    } else {
      // For PDF, TXT, MD — extract plain text then convert
      const text = await extractText(buffer, file.type);
      content = textToTipTapJSON(text);
    }

    // Always extract plain text for the textContent field (used for search)
    const textContent = await extractText(buffer, file.type);

    // Derive page title from filename (without extension)
    const filename = file.name || 'Imported File';
    const title = filename.replace(/\.[^.]+$/, '');

    // Determine sort order
    const maxOrder = await db.page.aggregate({
      where: { sectionId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    // Create the page
    const page = await db.page.create({
      data: {
        sectionId,
        title,
        content,
        textContent,
        sortOrder,
        sourceDocId: null,
      },
    });

    // Extract and save embedded images from PDF files
    if (file.type === 'application/pdf') {
      try {
        const { extractPdfImages } = await import('@/lib/pdf-image-extractor');
        const extractedImages = await extractPdfImages(buffer);

        const imageNodes = [];
        for (const img of extractedImages) {
          const { filePath } = await saveImage(page.id, img.fileName, img.buffer);
          const pageImage = await db.pageImage.create({
            data: {
              pageId: page.id,
              fileName: img.fileName,
              filePath,
              fileSize: img.buffer.length,
              mimeType: img.mimeType,
            },
          });
          imageNodes.push({
            type: 'resizableImage',
            attrs: { src: `/api/uploads/images/${pageImage.id}`, alt: img.fileName, width: null },
          });
        }

        // Embed extracted images into the TipTap content
        if (imageNodes.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingContent = (page.content as any) ?? { type: 'doc', content: [] };
          const updatedContent = {
            ...existingContent,
            content: [...(existingContent.content ?? []), ...imageNodes],
          };
          await db.page.update({
            where: { id: page.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { content: updatedContent as any },
          });
        }
      } catch (imageError) {
        // Log but don't fail the import if image extraction fails
        console.error('PDF image extraction error:', imageError);
      }
    }

    return createdResponse(page);
  } catch (error) {
    console.error('File import error:', error);
    return internalErrorResponse();
  }
}
