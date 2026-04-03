import { db } from '@/lib/db';
import { successResponse, badRequestResponse, internalErrorResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return badRequestResponse('Email is required');
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return badRequestResponse('Invalid email address');
    }

    // Upsert — if already on waitlist, just return success
    await db.waitlist.upsert({
      where: { email: trimmed },
      update: {},
      create: { email: trimmed },
    });

    return successResponse({ email: trimmed }, 'Successfully joined the waitlist!');
  } catch (error) {
    console.error('Waitlist signup error:', error);
    return internalErrorResponse();
  }
}
