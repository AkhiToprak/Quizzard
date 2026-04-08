import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api-response';

// GET /api/groups — list groups the user is a member of
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type'); // "study_group" | "class" | null

    const memberships = await db.studyGroupMember.findMany({
      where: {
        userId,
        status: 'accepted',
        ...(typeFilter ? { group: { type: typeFilter } } : {}),
      },
      include: {
        group: {
          include: {
            _count: {
              select: {
                members: { where: { status: 'accepted' } },
                notebooks: true,
              },
            },
            owner: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      avatarUrl: m.group.avatarUrl,
      ownerId: m.group.ownerId,
      owner: m.group.owner,
      type: m.group.type,
      role: m.role,
      memberCount: m.group._count.members,
      notebookCount: m.group._count.notebooks,
      joinedAt: m.joinedAt,
      createdAt: m.group.createdAt,
      updatedAt: m.group.updatedAt,
    }));

    return successResponse({ groups, count: groups.length });
  } catch {
    return internalErrorResponse();
  }
}

// POST /api/groups — create a new group
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const { name, description, type = 'study_group' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequestResponse('Group name is required');
    }

    if (name.trim().length > 100) {
      return badRequestResponse('Group name must be 100 characters or less');
    }

    const validTypes = ['study_group', 'class'];
    if (!validTypes.includes(type)) {
      return badRequestResponse('Type must be "study_group" or "class"');
    }

    // For classes: creator becomes teacher, permissions default to restrictive
    const isClass = type === 'class';
    const creatorRole = isClass ? 'teacher' : 'owner';

    const group = await db.studyGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: userId,
        type,
        allowMemberChat: !isClass,     // false for classes (restrictive)
        allowMemberSharing: !isClass,  // false for classes (restrictive)
        allowMemberInvites: !isClass,  // false for classes (restrictive)
        members: {
          create: {
            userId,
            role: creatorRole,
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        _count: {
          select: { members: true, notebooks: true },
        },
      },
    });

    return createdResponse({
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      ownerId: group.ownerId,
      owner: group.owner,
      memberCount: group._count.members,
      notebookCount: group._count.notebooks,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch {
    return internalErrorResponse();
  }
}
