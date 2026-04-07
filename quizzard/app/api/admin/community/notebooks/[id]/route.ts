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

// DELETE — admin remove a shared notebook from the community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAdminUserId(request);
    if (!adminId) return forbiddenResponse('Admin access required');

    const { id: shareId } = await params;

    const share = await db.sharedNotebook.findUnique({
      where: { id: shareId },
      select: { id: true, notebookId: true },
    });
    if (!share) return notFoundResponse('Community notebook not found');

    // Only remove the share record, not the original notebook
    await db.sharedNotebook.delete({ where: { id: shareId } });

    await logAdminAction(adminId, 'community_notebook.delete', shareId, {
      notebookId: share.notebookId,
    });

    return successResponse({ deleted: true, shareId });
  } catch {
    return internalErrorResponse();
  }
}
