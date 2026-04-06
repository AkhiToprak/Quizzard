import { NextRequest } from 'next/server';
import { getAdminUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { logAdminAction } from '@/lib/admin-audit';

// DELETE — admin delete any post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAdminUserId(request);
    if (!adminId) return forbiddenResponse('Admin access required');

    const { id: postId } = await params;

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) return notFoundResponse('Post not found');

    await db.post.delete({ where: { id: postId } });

    await logAdminAction(adminId, 'post.delete', postId, { authorId: post.authorId });

    return successResponse({ deleted: true, postId });
  } catch {
    return internalErrorResponse();
  }
}
