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

const MAX_COMMENT_LENGTH = 500;

// GET — get comments for a post (cursor-paginated)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId } = await params;

    // Verify post exists
    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) return notFoundResponse('Post not found');

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { postId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const comments = await db.postComment.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const sliced = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? sliced[sliced.length - 1].createdAt.toISOString() : null;

    return successResponse({
      comments: sliced.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
      })),
      nextCursor,
    });
  } catch {
    return internalErrorResponse();
  }
}

// POST — create a comment on a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId } = await params;

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) return notFoundResponse('Post not found');

    const body = await request.json().catch(() => ({}));
    const { content } = body as { content?: string };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return badRequestResponse('Comment content is required');
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return badRequestResponse(`Comment must be ${MAX_COMMENT_LENGTH} characters or less`);
    }

    const comment = await db.postComment.create({
      data: {
        postId,
        authorId: userId,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Notify post author (don't notify self)
    if (post.authorId !== userId) {
      const commenter = await db.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      await db.notification.create({
        data: {
          userId: post.authorId,
          type: 'post_comment',
          data: {
            fromUserId: userId,
            fromUsername: commenter?.username,
            postId,
            commentPreview: content.trim().slice(0, 100),
          },
        },
      });
    }

    return createdResponse({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.author,
    });
  } catch {
    return internalErrorResponse();
  }
}
