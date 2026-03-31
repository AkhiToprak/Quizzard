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
import { xlsxToTipTapTableJSON, type SheetData } from '@/lib/contentConverter';
import { extractText } from '@/lib/fileProcessing';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

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
    if (!XLSX_MIMES.includes(file.type)) {
      return badRequestResponse('Unsupported file type. Only XLSX/XLS files are allowed.');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse('File exceeds maximum size of 10MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse workbook into sheet data
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheetsData: SheetData[] = workbook.SheetNames.map((name: string) => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false });
      return { name, rows: rows.map((r: string[]) => r.map((c: unknown) => String(c ?? ''))) };
    });

    // Convert to TipTap table JSON
    const content = xlsxToTipTapTableJSON(sheetsData) as unknown as Prisma.InputJsonValue;

    // Extract plain text for search index
    const textContent = await extractText(buffer, file.type);

    // Determine sort order
    const maxOrder = await db.page.aggregate({
      where: { sectionId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    // Derive title from filename
    const title = file.name.replace(/\.(xlsx|xls)$/i, '') || 'Excel Import';

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

    return createdResponse(page);
  } catch (error) {
    console.error('Excel import error:', error);
    return internalErrorResponse();
  }
}
