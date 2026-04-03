import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api-response';

const VALID_TIERS = ['FREE', 'PLUS', 'PRO'] as const;
type ValidTier = (typeof VALID_TIERS)[number];

/** GET — return current subscription info */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        pendingTier: true,
        subscriptionPeriodEnd: true,
      },
    });

    if (!user) return unauthorizedResponse();

    return successResponse(user);
  } catch (error) {
    console.error('[GET /api/user/subscription]', error);
    return internalErrorResponse();
  }
}

/** POST — cancel subscription or change plan (takes effect at end of period) */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const { action, newTier } = body as { action: 'cancel' | 'change'; newTier?: string };

    if (action !== 'cancel' && action !== 'change') {
      return badRequestResponse('Invalid action. Must be "cancel" or "change".');
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { tier: true, subscriptionPeriodEnd: true },
    });

    if (!user) return unauthorizedResponse();

    if (action === 'cancel') {
      // Cancel: set pending tier to FREE at end of period
      if (user.tier === 'FREE') {
        return badRequestResponse('You are already on the Free plan.');
      }

      const periodEnd = user.subscriptionPeriodEnd ?? getFallbackPeriodEnd();

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          pendingTier: 'FREE',
          subscriptionPeriodEnd: periodEnd,
        },
        select: { tier: true, pendingTier: true, subscriptionPeriodEnd: true },
      });

      return successResponse(updated, 'Subscription will be cancelled at end of billing period.');
    }

    // action === 'change'
    if (!newTier || !VALID_TIERS.includes(newTier as ValidTier)) {
      return badRequestResponse('Invalid tier. Must be FREE, PLUS, or PRO.');
    }

    if (newTier === user.tier) {
      return badRequestResponse('You are already on this plan.');
    }

    // If user is on FREE and upgrading, apply immediately (no payment yet)
    if (user.tier === 'FREE') {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          tier: newTier as ValidTier,
          pendingTier: null,
          subscriptionPeriodEnd: periodEnd,
        },
        select: { tier: true, pendingTier: true, subscriptionPeriodEnd: true },
      });

      return successResponse(updated, 'Plan upgraded successfully.');
    }

    // Paid user changing plan: schedule change at end of period
    const periodEnd = user.subscriptionPeriodEnd ?? getFallbackPeriodEnd();

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        pendingTier: newTier as ValidTier,
        subscriptionPeriodEnd: periodEnd,
      },
      select: { tier: true, pendingTier: true, subscriptionPeriodEnd: true },
    });

    return successResponse(updated, 'Plan change scheduled for end of billing period.');
  } catch (error) {
    console.error('[POST /api/user/subscription]', error);
    return internalErrorResponse();
  }
}

/** DELETE — undo a pending tier change */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const updated = await db.user.update({
      where: { id: userId },
      data: { pendingTier: null },
      select: { tier: true, pendingTier: true, subscriptionPeriodEnd: true },
    });

    return successResponse(updated, 'Pending change cancelled.');
  } catch (error) {
    console.error('[DELETE /api/user/subscription]', error);
    return internalErrorResponse();
  }
}

/** Fallback: if no period end is set, assume 30 days from now */
function getFallbackPeriodEnd(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}
