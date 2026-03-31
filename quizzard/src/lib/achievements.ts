export interface UserStats {
  notebookCount: number;
  documentCount: number;
  messageCount: number;
  quizAttemptCount: number;
  perfectQuizCount: number;
  flashcardReviewCount: number;
  currentStreak: number;
  friendCount: number;
  sharedNotebookCount: number;
  groupCount: number;
  pageCount: number;
}

export interface AchievementDef {
  badge: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: 'study' | 'social' | 'streak' | 'content';
  checkCondition: (stats: UserStats) => boolean;
  getProgress: (stats: UserStats) => { current: number; target: number };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Content ──────────────────────────────────────────────────────────
  {
    badge: 'first_notebook',
    name: 'Fresh Start',
    description: 'Create your first notebook',
    icon: 'BookOpen',
    category: 'content',
    checkCondition: (s) => s.notebookCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.notebookCount, 1), target: 1 }),
  },
  {
    badge: 'first_upload',
    name: 'Material Girl',
    description: 'Upload your first document',
    icon: 'Upload',
    category: 'content',
    checkCondition: (s) => s.documentCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.documentCount, 1), target: 1 }),
  },
  {
    badge: '10_notebooks',
    name: 'Bookworm',
    description: 'Create 10 notebooks',
    icon: 'Library',
    category: 'content',
    checkCondition: (s) => s.notebookCount >= 10,
    getProgress: (s) => ({ current: Math.min(s.notebookCount, 10), target: 10 }),
  },
  {
    badge: '50_pages',
    name: 'Prolific Writer',
    description: 'Write 50 pages',
    icon: 'PenTool',
    category: 'content',
    checkCondition: (s) => s.pageCount >= 50,
    getProgress: (s) => ({ current: Math.min(s.pageCount, 50), target: 50 }),
  },

  // ── Study ────────────────────────────────────────────────────────────
  {
    badge: '100_messages',
    name: 'Chatterbox',
    description: 'Send 100 chat messages',
    icon: 'MessageSquare',
    category: 'study',
    checkCondition: (s) => s.messageCount >= 100,
    getProgress: (s) => ({ current: Math.min(s.messageCount, 100), target: 100 }),
  },
  {
    badge: '500_messages',
    name: 'Deep Thinker',
    description: 'Send 500 chat messages',
    icon: 'Brain',
    category: 'study',
    checkCondition: (s) => s.messageCount >= 500,
    getProgress: (s) => ({ current: Math.min(s.messageCount, 500), target: 500 }),
  },
  {
    badge: 'first_quiz',
    name: 'Quiz Whiz',
    description: 'Complete your first quiz',
    icon: 'HelpCircle',
    category: 'study',
    checkCondition: (s) => s.quizAttemptCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.quizAttemptCount, 1), target: 1 }),
  },
  {
    badge: 'perfect_quiz',
    name: 'Perfectionist',
    description: 'Score 100% on a quiz',
    icon: 'Award',
    category: 'study',
    checkCondition: (s) => s.perfectQuizCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.perfectQuizCount, 1), target: 1 }),
  },
  {
    badge: 'first_flashcard_review',
    name: 'Card Shark',
    description: 'Complete your first flashcard review',
    icon: 'Layers',
    category: 'study',
    checkCondition: (s) => s.flashcardReviewCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.flashcardReviewCount, 1), target: 1 }),
  },

  // ── Streak ───────────────────────────────────────────────────────────
  {
    badge: '7_day_streak',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: 'Flame',
    category: 'streak',
    checkCondition: (s) => s.currentStreak >= 7,
    getProgress: (s) => ({ current: Math.min(s.currentStreak, 7), target: 7 }),
  },
  {
    badge: '30_day_streak',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: 'Flame',
    category: 'streak',
    checkCondition: (s) => s.currentStreak >= 30,
    getProgress: (s) => ({ current: Math.min(s.currentStreak, 30), target: 30 }),
  },
  {
    badge: '100_day_streak',
    name: 'Centurion',
    description: 'Maintain a 100-day streak',
    icon: 'Flame',
    category: 'streak',
    checkCondition: (s) => s.currentStreak >= 100,
    getProgress: (s) => ({ current: Math.min(s.currentStreak, 100), target: 100 }),
  },
  {
    badge: '365_day_streak',
    name: 'Legend',
    description: 'Maintain a 365-day streak',
    icon: 'Crown',
    category: 'streak',
    checkCondition: (s) => s.currentStreak >= 365,
    getProgress: (s) => ({ current: Math.min(s.currentStreak, 365), target: 365 }),
  },

  // ── Social ───────────────────────────────────────────────────────────
  {
    badge: 'first_friend',
    name: 'Study Buddy',
    description: 'Add your first friend',
    icon: 'UserPlus',
    category: 'social',
    checkCondition: (s) => s.friendCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.friendCount, 1), target: 1 }),
  },
  {
    badge: 'first_share',
    name: 'Generous Scholar',
    description: 'Publish a notebook to the community',
    icon: 'Share2',
    category: 'social',
    checkCondition: (s) => s.sharedNotebookCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.sharedNotebookCount, 1), target: 1 }),
  },
  {
    badge: '10_friends',
    name: 'Social Butterfly',
    description: 'Have 10 friends',
    icon: 'Users',
    category: 'social',
    checkCondition: (s) => s.friendCount >= 10,
    getProgress: (s) => ({ current: Math.min(s.friendCount, 10), target: 10 }),
  },
  {
    badge: 'first_group',
    name: 'Team Player',
    description: 'Join or create a study group',
    icon: 'Users',
    category: 'social',
    checkCondition: (s) => s.groupCount >= 1,
    getProgress: (s) => ({ current: Math.min(s.groupCount, 1), target: 1 }),
  },
];

export function getAchievementDef(badge: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.badge === badge);
}
