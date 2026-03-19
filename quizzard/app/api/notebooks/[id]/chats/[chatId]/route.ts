import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

type Params = { params: Promise<{ id: string; chatId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, chatId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chat = await db.notebookChat.findFirst({
      where: { id: chatId, notebookId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!chat) return notFoundResponse('Chat not found');

    return successResponse(chat);
  } catch {
    return internalErrorResponse();
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, chatId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chat = await db.notebookChat.findFirst({ where: { id: chatId, notebookId } });
    if (!chat) return notFoundResponse('Chat not found');

    const body = await request.json().catch(() => ({}));
    const { title, contextPageIds, contextDocIds } = body as {
      title?: string;
      contextPageIds?: string[];
      contextDocIds?: string[];
    };

    const updated = await db.notebookChat.update({
      where: { id: chatId },
      data: {
        ...(title !== undefined && { title }),
        ...(contextPageIds !== undefined && { contextPageIds }),
        ...(contextDocIds !== undefined && { contextDocIds }),
      },
    });

    return successResponse(updated);
  } catch {
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, chatId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chat = await db.notebookChat.findFirst({ where: { id: chatId, notebookId } });
    if (!chat) return notFoundResponse('Chat not found');

    await db.notebookChat.delete({ where: { id: chatId } });

    return successResponse({ deleted: true });
  } catch {
    return internalErrorResponse();
  }
}
