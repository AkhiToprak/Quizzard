import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chats = await db.notebookChat.findMany({
      where: { notebookId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        contextPageIds: true,
        contextDocIds: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return successResponse(chats);
  } catch {
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const body = await request.json().catch(() => ({}));
    const { title, contextPageIds = [], contextDocIds = [] } = body as {
      title?: string;
      contextPageIds?: string[];
      contextDocIds?: string[];
    };

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return badRequestResponse('Chat title cannot be empty');
    }

    const chat = await db.notebookChat.create({
      data: {
        notebookId,
        title: title.trim(),
        contextPageIds,
        contextDocIds,
      },
    });

    return createdResponse(chat);
  } catch {
    return internalErrorResponse();
  }
}
