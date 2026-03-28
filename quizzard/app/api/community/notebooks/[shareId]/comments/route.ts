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

type Params = { params: Promise<{ shareId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: { id: true },
    });
    if (!share) return notFoundResponse('Shared notebook not found');

    const comments = await db.notebookComment.findMany({
      where: { sharedNotebookId: shareId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        votes: { select: { userId: true, value: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const mapped = comments.map((c) => {
      const upvotes = c.votes.filter((v) => v.value === 1).length;
      const downvotes = c.votes.filter((v) => v.value === -1).length;
      const userVote = c.votes.find((v) => v.userId === userId)?.value || 0;
      return {
        id: c.id,
        parentCommentId: c.parentCommentId,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        userVote,
        replyCount: c._count.replies,
      };
    });

    return successResponse({ comments: mapped });
  } catch {
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: { id: true },
    });
    if (!share) return notFoundResponse('Shared notebook not found');

    const body = await request.json().catch(() => ({}));
    const { content, parentCommentId } = body as {
      content?: string;
      parentCommentId?: string;
    };

    const trimmed = content?.trim();
    if (!trimmed || trimmed.length === 0) {
      return badRequestResponse('Comment content is required');
    }
    if (trimmed.length > 1000) {
      return badRequestResponse('Comment must be 1000 characters or less');
    }

    // Validate parent comment exists and belongs to this notebook
    if (parentCommentId) {
      const parent = await db.notebookComment.findUnique({
        where: { id: parentCommentId },
        select: { sharedNotebookId: true },
      });
      if (!parent || parent.sharedNotebookId !== shareId) {
        return badRequestResponse('Parent comment not found');
      }
    }

    const comment = await db.notebookComment.create({
      data: {
        sharedNotebookId: shareId,
        authorId: userId,
        parentCommentId: parentCommentId || null,
        content: trimmed,
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    return createdResponse({
      id: comment.id,
      parentCommentId: comment.parentCommentId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.author,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      userVote: 0,
      replyCount: 0,
    });
  } catch {
    return internalErrorResponse();
  }
}
