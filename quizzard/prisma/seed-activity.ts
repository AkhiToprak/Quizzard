import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const TARGET_EMAIL = '4toprak25@gmail.com';
const ACTIVITY_TYPES = ['message', 'page_edit', 'quiz', 'flashcard_review'];

async function main() {
  const user = await db.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.error(`User with email ${TARGET_EMAIL} not found.`);
    process.exit(1);
  }

  console.log(`Seeding activity data for ${TARGET_EMAIL} (${user.id})...`);

  const records: {
    userId: string;
    date: Date;
    type: string;
    count: number;
  }[] = [];

  const now = new Date();

  for (let daysAgo = 364; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);

    // ~70% chance of having activity on any given day
    if (Math.random() > 0.7) continue;

    // Pick 1-3 random activity types for this day
    const typeCount = Math.ceil(Math.random() * 3);
    const shuffled = [...ACTIVITY_TYPES].sort(() => Math.random() - 0.5);
    const typesForDay = shuffled.slice(0, typeCount);

    for (const type of typesForDay) {
      records.push({
        userId: user.id,
        date,
        type,
        count: Math.floor(Math.random() * 8) + 1, // 1-8 per type
      });
    }
  }

  // Upsert to avoid conflicts with real data
  let created = 0;
  let updated = 0;

  for (const r of records) {
    const result = await db.activityEvent.upsert({
      where: { userId_date_type: { userId: r.userId, date: r.date, type: r.type } },
      update: { count: { increment: r.count } },
      create: r,
    });
    // If createdAt is very recent, it was just created
    if (new Date().getTime() - result.createdAt.getTime() < 1000) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`Done! ${created} records created, ${updated} records updated (${records.length} total).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
