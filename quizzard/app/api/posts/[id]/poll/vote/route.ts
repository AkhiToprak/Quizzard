import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { canUserSeePost } from '@/lib/post-visibility';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response';

// POST — vote on a poll option
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: postId } = await params;

    // Get the post's poll and visibility info
    const post = await db.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        visibility: true,
        poll: {
          select: {
            id: true,
            options: { select: { id: true } },
          },
        },
      },
    });

    if (!post) return notFoundResponse('Post not found');

    // Enforce visibility
    if (!(await canUserSeePost(post, userId))) {
      return notFoundResponse('Post not found');
    }

    if (!post.poll) return notFoundResponse('This post has no poll');

    const body = await request.json().catch(() => ({}));
    const { optionId } = body as { optionId?: string };

    if (!optionId || typeof optionId !== 'string') {
      return badRequestResponse('optionId is required');
    }

    // Verify the option belongs to this poll
    const validOptionIds = new Set(post.poll.options.map((o) => o.id));
    if (!validOptionIds.has(optionId)) {
      return badRequestResponse('Invalid option for this poll');
    }

    // Check if user already voted on this poll (any option)
    const existingVote = await db.pollVote.findFirst({
      where: {
        userId,
        option: { pollId: post.poll.id },
      },
    });

    if (existingVote) {
      if (existingVote.optionId === optionId) {
        // Same option — no change needed
      } else {
        // Change vote: delete old, create new
        await db.$transaction([
          db.pollVote.delete({ where: { id: existingVote.id } }),
          db.pollVote.create({ data: { optionId, userId } }),
        ]);
      }
    } else {
      // New vote
      await db.pollVote.create({ data: { optionId, userId } });
    }

    // Return updated poll with vote counts
    const poll = await db.poll.findUnique({
      where: { id: post.poll.id },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
      },
    });

    if (!poll) return internalErrorResponse();

    // Get user's current vote
    const userVote = await db.pollVote.findFirst({
      where: { userId, option: { pollId: poll.id } },
      select: { optionId: true },
    });

    return successResponse({
      poll: {
        id: poll.id,
        question: poll.question,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          sortOrder: opt.sortOrder,
          voteCount: opt._count.votes,
          userVoted: opt.id === userVote?.optionId,
        })),
      },
    });
  } catch {
    return internalErrorResponse();
  }
}
