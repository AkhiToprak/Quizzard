import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(`unlock:${ip}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid request.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { unlockToken: token },
      select: { id: true, unlockTokenExpiry: true },
    });

    if (!user || !user.unlockTokenExpiry || user.unlockTokenExpiry.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'This unlock link is invalid or has expired. Please try logging in again to receive a new link.' },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedAt: null,
        unlockToken: null,
        unlockTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
