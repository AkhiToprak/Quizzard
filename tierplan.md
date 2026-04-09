# Tier System Implementation Plan

## Context
Notemage needs a subscription tier system (Free / Plus / Pro) to gate AI features. No real payments yet — users pick a tier during onboarding and get it instantly. This adds: database schema, onboarding step, tier badges, usage tracking with enforcement, a public pricing page, and a navbar link.

---

## Phase 1: Foundation

### 1a. Prisma Schema
**File:** `prisma/schema.prisma`
- Add `Tier` enum: `FREE`, `PLUS`, `PRO`
- Add `tier Tier @default(FREE)` to `User` model
- Add `usageRecords UsageRecord[]` relation to `User`
- Add `UsageRecord` model:
  ```
  id, userId, featureType (string), month (Date), count (Int @default(0)), updatedAt
  @@unique([userId, featureType, month])
  ```
- Run migration: `npx prisma migrate dev --name add-tier-and-usage`

### 1b. Tier Constants
**New file:** `src/lib/tiers.ts`
- Export `TIERS` object with name, priceCHF, limits, badge styling for each tier
- Limits: Free (1 flashcard, 1 pptx, 2 study plans, 20 chats), Plus (4, 3, 4, 100), Pro (unlimited)
- Export types: `TierKey`, `FeatureType`
- Helper: `getMonthStart()` → first day of current month UTC

### 1c. Usage Limits Module
**New file:** `src/lib/usage-limits.ts`
- `checkUsageLimit(userId, featureType)` → `{ allowed, used, limit }`
- `incrementUsage(userId, featureType)` → upsert with atomic increment
- `getUserUsageSummary(userId)` → all feature usage for current month

### 1d. Tier API Endpoint
**New file:** `app/api/user/tier/route.ts`
- `PUT` — validate tier value, update `db.user.update({ data: { tier } })`

---

## Phase 2: Auth Pipeline

### 2a. Type Declarations
**File:** `src/types/next-auth.d.ts`
- Add `tier: string` to `Session.user`
- Add `tier?: string` to `JWT`

### 2b. Auth Config
**File:** `src/auth/config.ts`
- `authorize`: add `tier` to select + return object
- `jwt` callback: map `user.tier` → `token.tier` on sign-in
- `jwt` callback `trigger === 'update'`: refresh `token.tier` from DB
- `session` callback: map `token.tier` → `session.user.tier`

---

## Phase 3: Onboarding (4-step wizard)

### 3a. Shared PricingCard Component
**New file:** `src/components/pricing/PricingCard.tsx`
- Reusable card component for both onboarding and pricing page
- Props: tier config, selected state, onSelect callback, ctaText/ctaHref
- Neon Scholar aesthetic: dark purple cards, glassmorphism, glow effects
- Plus card: purple accent + "Popular" badge
- Pro card: gold (#ffde59) accent

### 3b. TierSelectionStep
**New file:** `src/components/onboarding/TierSelectionStep.tsx`
- Renders 3 PricingCards in a row
- Props: selectedTier, onSelect, onNext, loading, error
- Calls `PUT /api/user/tier` on next, then advances

### 3c. StepIndicator Fix
**File:** `src/components/onboarding/StepIndicator.tsx`
- Change `totalSteps` type from literal `3` to `number`

### 3d. OnboardingWizard Update
**File:** `src/components/onboarding/OnboardingWizard.tsx`
- Steps: Account → **Plan** → Avatar → Goals (4 steps)
- Update `STEP_LABELS` to `['Account', 'Plan', 'Avatar', 'Goals']`
- Update step state type to `1 | 2 | 3 | 4`
- Add `selectedTier: 'FREE'` to FormData
- Insert TierSelectionStep at step 2, shift Avatar→3, Goals→4
- Read `?tier=` query param to pre-select tier from pricing page
- Call `updateSession()` after tier is saved so JWT reflects new tier

---

## Phase 4: UI Badges

### 4a. TierBadge Component
**New file:** `src/components/ui/TierBadge.tsx`
- Small pill showing tier name with tier-specific colors
- Free: muted gray, Plus: purple glow, Pro: gold glow

### 4b. Badge Integration
Add `<TierBadge>` next to username in:
- `src/components/layout/HomeHeader.tsx` (avatar dropdown)
- `src/components/layout/Header.tsx` (dashboard header)
- `src/components/layout/BurgerMenu.tsx` (mobile drawer)
- `src/components/layout/Sidebar.tsx` (if username shown)

---

## Phase 5: Usage Enforcement

Add `checkUsageLimit` + `incrementUsage` calls to these API routes:

### 5a. Scholar Chat Messages
**File:** `app/api/notebooks/[id]/chats/[chatId]/messages/route.ts`
- Check `scholar_chat` limit before calling Anthropic API
- Increment after successful response

### 5b. AI Flashcard Generation
Same file as 5a — after AI responds and `create_flashcards` tool is extracted, check `ai_flashcards` limit before persisting. If over limit, return friendly message.

### 5c. AI Presentation Generation
Same file — check `ai_pptx` limit when `create_presentation` tool is used.

### 5d. Study Plan Generation
**File:** `app/api/notebooks/[id]/study-plans/generate/route.ts`
- Check `ai_study_plan` before generation, increment after

### 5e. Exam Study Plan
**File:** `app/api/user/exams/[id]/generate-plan/route.ts`
- Same pattern as 5d

### 5f. Usage API Endpoint
**New file:** `app/api/user/usage/route.ts`
- `GET` — returns current month usage summary for the authenticated user
- Used by frontend to show remaining limits in UI

---

## Phase 6: Public Pricing Page

### 6a. Currency Utilities
**New file:** `src/lib/currency.ts`
- Static CHF exchange rates map (USD: 1.12, EUR: 1.04, GBP: 0.89, etc.)
- `detectCurrency(locale)` → currency code from browser locale
- `formatPrice(amountCHF, currencyCode)` → formatted string

**New file:** `src/hooks/useCurrency.ts`
- Hook using `navigator.language` to detect currency
- Returns `{ currency, formatPrice }`

### 6b. Middleware Update
**File:** `src/middleware.ts`
- Add `/pricing` to matcher
- Allow unauthenticated access (early return before the unauth redirect)

### 6c. Pricing Page
**New file:** `app/(public)/pricing/page.tsx`
- Same navbar style as landing page (Logo, Pricing, How It Works, Log in, Get Started)
- Hero: "Choose Your Plan" heading
- 3 PricingCards with currency-converted prices
- CTA buttons link to `/auth/register?tier=FREE|PLUS|PRO`
- Matches Neon Scholar aesthetic (particles, glows, dark background)

### 6d. Landing Page Navbar
**File:** `app/page.tsx` (~line 498)
- Add `<Link href="/pricing" className="nlink">Pricing</Link>` between "How It Works" and "Log in"

---

## Verification
1. Run `npx prisma migrate dev` — confirm migration succeeds
2. Run `npm run build` — no TypeScript errors
3. Test onboarding flow: register → tier selection (step 2) → avatar → goals → arrives at /home with tier set
4. Check session: `session.user.tier` should reflect selected tier
5. Verify TierBadge appears next to username in header/sidebar
6. Visit `/pricing` while logged out — page loads, cards show currency-converted prices
7. Click "Get Started" on pricing page → lands on register with tier pre-selected
8. Test usage limits: create AI content, verify counts increment, verify block at limit
