import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search')?.trim().slice(0, 100);
    const subject = searchParams.get('subject')?.trim().slice(0, 100);
    const tag = searchParams.get('tag')?.trim().slice(0, 100);
    const sort = searchParams.get('sort') || 'newest';
    const period = searchParams.get('period') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const skip = (page - 1) * limit;

    // Build the where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      sharedWithId: null, // community shares only
    };

    if (filter === 'friends') {
      // Get friend IDs
      const friendships = await db.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) =>
        f.requesterId === userId ? f.addresseeId : f.requesterId
      );
      where.OR = [
        { visibility: 'public', sharedById: { in: friendIds } },
        { visibility: 'friends', sharedById: { in: friendIds } },
      ];
    } else if (filter === 'mine') {
      where.sharedById = userId;
    } else {
      // 'all' — public notebooks + friends-visible from actual friends
      const friendships = await db.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) =>
        f.requesterId === userId ? f.addresseeId : f.requesterId
      );
      where.OR = [
        { visibility: 'public' },
        { visibility: 'friends', sharedById: { in: friendIds } },
        { sharedById: userId },
      ];
    }

    // Tag filter
    if (tag) {
      const tagNames = tag.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tagNames.length > 0) {
        where.tags = {
          some: {
            tag: { name: { in: tagNames } },
          },
        };
      }
    }

    // Period filter
    if (period !== 'all') {
      const now = new Date();
      let since: Date;
      switch (period) {
        case 'week':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          since = new Date(0);
      }
      where.createdAt = { gte: since };
    }

    // Build notebook filter conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notebookWhere: any = {};
    if (search) {
      // Search in both notebook name and custom publish title
      where.OR = [
        ...(where.OR || []),
      ];
      // We need a different approach: add search conditions at the top level
      notebookWhere.name = { contains: search, mode: 'insensitive' };
    }
    if (subject) {
      notebookWhere.subject = { contains: subject, mode: 'insensitive' };
    }

    if (search) {
      // Search matches notebook name OR custom share title OR tag names
      const baseOr = where.OR;
      delete where.OR;
      const searchConditions = {
        OR: [
          { notebook: { name: { contains: search, mode: 'insensitive' } } },
          { title: { contains: search, mode: 'insensitive' } },
          { tags: { some: { tag: { name: { contains: search.toLowerCase(), mode: 'insensitive' } } } } },
        ],
      };
      if (subject) {
        where.notebook = { subject: { contains: subject, mode: 'insensitive' } };
      }
      where.AND = [
        ...(baseOr ? [{ OR: baseOr }] : []),
        searchConditions,
      ];
    } else if (Object.keys(notebookWhere).length > 0) {
      where.notebook = notebookWhere;
    }

    // Determine order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    switch (sort) {
      case 'downloads':
        orderBy = { downloads: { _count: 'desc' } };
        break;
      case 'rating':
        orderBy = { ratings: { _count: 'desc' } };
        break;
      case 'views':
        orderBy = { views: { _count: 'desc' } };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [shares, total] = await Promise.all([
      db.sharedNotebook.findMany({
        where,
        include: {
          notebook: {
            select: {
              id: true,
              name: true,
              subject: true,
              color: true,
              _count: { select: { sections: true } },
            },
          },
          sharedBy: {
            select: { id: true, username: true, avatarUrl: true },
          },
          tags: {
            include: { tag: { select: { name: true } } },
          },
          _count: {
            select: { downloads: true, ratings: true, views: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.sharedNotebook.count({ where }),
    ]);

    // Compute average ratings in bulk
    const shareIds = shares.map((s) => s.id);
    const ratingAggs = await db.notebookRating.groupBy({
      by: ['sharedNotebookId'],
      where: { sharedNotebookId: { in: shareIds } },
      _avg: { value: true },
    });
    const avgRatingMap = new Map(
      ratingAggs.map((r) => [r.sharedNotebookId, r._avg.value || 0])
    );

    const notebooks = shares.map((s) => ({
      shareId: s.id,
      notebookId: s.notebook.id,
      name: s.notebook.name,
      subject: s.notebook.subject,
      color: s.notebook.color,
      sectionCount: s.notebook._count.sections,
      shareType: s.type,
      visibility: s.visibility,
      title: s.title,
      description: s.description,
      coverImageUrl: s.coverImageUrl,
      author: s.sharedBy,
      sharedAt: s.createdAt,
      downloadCount: s._count.downloads,
      ratingCount: s._count.ratings,
      averageRating: Math.round((avgRatingMap.get(s.id) || 0) * 10) / 10,
      viewCount: s._count.views,
      tags: s.tags.map((t) => t.tag.name),
    }));

    return successResponse({
      notebooks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return internalErrorResponse();
  }
}
