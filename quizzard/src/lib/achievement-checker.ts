import { db } from '@/lib/db';
import { ACHIEVEMENTS, UserStats } from './achievements';

export async function gatherUserStats(userId: string): Promise<UserStats> {
  const [
    notebookCount,
    documentCount,
    messageCount,
    quizAttemptCount,
    perfectQuizCount,
    flashcardReviewAgg,
    streak,
    friendCount,
    sharedNotebookCount,
    groupCount,
    pageCount,
  ] = await Promise.all([
    // Notebooks owned by user
    db.notebook.count({ where: { userId } }),

    // Documents in user's notebooks
    db.document.count({
      where: { notebook: { userId } },
    }),

    // Chat messages sent by user (role: 'user')
    db.chatMessage.count({
      where: { userId, role: 'user' },
    }),

    // Quiz attempts
    db.quizAttempt.count({ where: { userId } }),

    // Perfect quiz scores (100%)
    db.quizAttempt.count({ where: { userId, percentage: 100 } }),

    // Flashcard reviews from activity events
    db.activityEvent.aggregate({
      _sum: { count: true },
      where: { userId, type: 'flashcard_review' },
    }),

    // Current streak
    db.userStreak.findUnique({
      where: { userId },
      select: { currentStreak: true },
    }),

    // Friends (accepted friendships where user is either side)
    db.friendship.count({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    }),

    // Community publishes (shared notebooks with no specific recipient)
    db.sharedNotebook.count({
      where: { sharedById: userId, sharedWithId: null },
    }),

    // Study group memberships
    db.studyGroupMember.count({ where: { userId } }),

    // Pages in user's notebooks → sections → pages
    db.page.count({
      where: { section: { notebook: { userId } } },
    }),
  ]);

  return {
    notebookCount,
    documentCount,
    messageCount,
    quizAttemptCount,
    perfectQuizCount,
    flashcardReviewCount: flashcardReviewAgg._sum.count ?? 0,
    currentStreak: streak?.currentStreak ?? 0,
    friendCount,
    sharedNotebookCount,
    groupCount,
    pageCount,
  };
}

export async function checkAndUnlockAchievements(
  userId: string
): Promise<{ badge: string; name: string }[]> {
  // 1. Gather stats and existing achievements in parallel
  const [stats, existingAchievements] = await Promise.all([
    gatherUserStats(userId),
    db.achievement.findMany({
      where: { userId },
      select: { badge: true },
    }),
  ]);

  const unlockedBadges = new Set(existingAchievements.map((a) => a.badge));

  // 2. Determine newly earned achievements
  const newlyUnlocked: { badge: string; name: string; description: string; icon: string }[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedBadges.has(achievement.badge)) continue;
    if (!achievement.checkCondition(stats)) continue;

    newlyUnlocked.push({
      badge: achievement.badge,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
    });
  }

  if (newlyUnlocked.length === 0) return [];

  // 3. Create achievement records and notifications atomically
  await db.$transaction(
    newlyUnlocked.flatMap((a) => [
      db.achievement.create({
        data: {
          userId,
          badge: a.badge,
        },
      }),
      db.notification.create({
        data: {
          userId,
          type: 'achievement_unlocked',
          data: {
            badge: a.badge,
            name: a.name,
            description: a.description,
            icon: a.icon,
          },
        },
      }),
    ])
  );

  return newlyUnlocked.map(({ badge, name }) => ({ badge, name }));
}
