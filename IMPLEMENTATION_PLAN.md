# Implementation Plan: Community Hub — Real Data, Tags, Catalog & Publish Flow

> **Status:** DRAFT — awaiting approval before implementation begins.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Publish Flow (Full Rework)](#3-publish-flow-full-rework)
4. [Tags System & Trending Tags](#4-tags-system--trending-tags)
5. [Real Download Counts & Ratings](#5-real-download-counts--ratings)
6. [View Count Tracking](#6-view-count-tracking)
7. [Friends Status Card — Real Data](#7-friends-status-card--real-data)
8. [Notebook Catalog Page ("View All")](#8-notebook-catalog-page-view-all)
9. [Home Page Integration](#9-home-page-integration)
10. [API Endpoints Summary](#10-api-endpoints-summary)
11. [Migration & Rollout Order](#11-migration--rollout-order)

---

## 1. Overview

The home page currently relies on mock/fake data in three areas:

| Area | Current State | Target State |
|---|---|---|
| Published notebooks (downloads, ratings) | Random numbers / hardcoded mock | Real DB-tracked downloads & ratings |
| Friends Status card | `MOCK_FRIENDS` array with fake activities | Real friend activity feed from DB |
| Trending Tags | 4 hardcoded tags | Dynamically computed from tag view-counts |
| "View All" button | No-op | Links to full catalog page |
| "Publish Now" button | Links to `/dashboard` | Opens a multi-step publish wizard |

Additionally, the publish flow needs to be rebuilt as a 7-step wizard, and a new "views" metric needs to be introduced to power the trending tags system.

---

## 2. Database Schema Changes

### 2.1 New Model: `Tag`

Stores every unique tag that has ever been used. Tags are user-typed (no presets), lowercased and trimmed on creation.

```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique          // lowercased, trimmed, e.g. "react_hooks"
  createdAt DateTime @default(now())

  sharedNotebookTags SharedNotebookTag[]

  @@index([name])
  @@map("tags")
}
```

### 2.2 New Model: `SharedNotebookTag` (join table)

Many-to-many between `SharedNotebook` and `Tag`.

```prisma
model SharedNotebookTag {
  id               String         @id @default(cuid())
  sharedNotebookId String
  tagId            String

  sharedNotebook   SharedNotebook @relation(fields: [sharedNotebookId], references: [id], onDelete: Cascade)
  tag              Tag            @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([sharedNotebookId, tagId])
  @@index([tagId])
  @@map("shared_notebook_tags")
}
```

### 2.3 New Model: `NotebookDownload`

Tracks every download event. One row per user per shared notebook (prevents inflating counts by re-downloading).

```prisma
model NotebookDownload {
  id               String         @id @default(cuid())
  sharedNotebookId String
  userId           String
  createdAt        DateTime       @default(now())

  sharedNotebook   SharedNotebook @relation(fields: [sharedNotebookId], references: [id], onDelete: Cascade)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sharedNotebookId, userId])
  @@map("notebook_downloads")
}
```

### 2.4 New Model: `NotebookRating`

One rating per user per shared notebook. Value is 1-5 integer.

```prisma
model NotebookRating {
  id               String         @id @default(cuid())
  sharedNotebookId String
  userId           String
  value            Int            // 1-5
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  sharedNotebook   SharedNotebook @relation(fields: [sharedNotebookId], references: [id], onDelete: Cascade)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sharedNotebookId, userId])
  @@map("notebook_ratings")
}
```

### 2.5 New Model: `NotebookView`

Tracks unique views per user per shared notebook. This is the core metric that powers trending tags.

```prisma
model NotebookView {
  id               String         @id @default(cuid())
  sharedNotebookId String
  userId           String
  createdAt        DateTime       @default(now())

  sharedNotebook   SharedNotebook @relation(fields: [sharedNotebookId], references: [id], onDelete: Cascade)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sharedNotebookId, userId])
  @@map("notebook_views")
}
```

### 2.6 New Model: `FriendActivity`

Logs real friend activities (download, publish, rate, etc.) for the friends status feed.

```prisma
model FriendActivity {
  id           String   @id @default(cuid())
  userId       String                    // who performed the action
  type         String                    // "downloaded" | "published" | "rated" | "viewed"
  targetName   String                    // notebook/item name for display
  targetColor  String?                   // color for UI display
  targetId     String?                   // optional link to SharedNotebook id
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("friend_activities")
}
```

### 2.7 Modifications to Existing Models

**`SharedNotebook`** — add new relations and a `content` field for rich post body:

```prisma
// Add to SharedNotebook:
  content      String?  @db.Text             // Rich text content (markdown/HTML) for the post body
  tags         SharedNotebookTag[]
  downloads    NotebookDownload[]
  ratings      NotebookRating[]
  views        NotebookView[]
```

**`User`** — add new relations:

```prisma
// Add to User:
  notebookDownloads  NotebookDownload[]
  notebookRatings    NotebookRating[]
  notebookViews      NotebookView[]
  friendActivities   FriendActivity[]
```

---

## 3. Publish Flow (Full Rework)

### 3.1 User Journey (7 Steps)

The current `ShareNotebookModal` will be replaced with a new multi-step publish wizard. This can be either a full-page route (`/publish`) or a large modal — both work, but a full page gives more room for the rich editor.

**Step 1 — Choose Notebook**
- Display a grid/list of the user's notebooks (fetched from `GET /api/notebooks`)
- Each card shows notebook name, subject, color, section count
- User selects one notebook to publish
- If the notebook is already published, show a warning / option to update the existing publication

**Step 2 — Choose Visibility**
- Two options: **Public** (visible to everyone) or **Friends Only** (visible only to accepted friends)
- Clear descriptions of what each means
- Radio/card selection UI

**Step 3 — Add Title**
- Text input for the publication title (required, max 200 chars)
- Pre-filled with the notebook name as a default
- Character counter

**Step 4 — Add Description Text (Optional)**
- A textarea or simple text editor for a short description / blurb
- Max 2000 characters
- This maps to the existing `description` field on `SharedNotebook`

**Step 5 — Rich Content Editor (Optional)**
- A GitHub README-style rich content area
- Support for:
  - Formatted text (bold, italic, headings, lists)
  - Code blocks with syntax highlighting
  - Image uploads (using existing `SharedNotebookImage` infrastructure)
  - Blockquotes
- This maps to the new `content` field on `SharedNotebook`
- Use TipTap (already in the project) for the rich editor
- Images uploaded here get stored as `SharedNotebookImage` records

**Step 6 — Add Tags (At Least One Required)**
- A tag input component:
  - User types a tag name
  - As they type, autocomplete suggests **existing tags** from the DB (fetched from `GET /api/tags?search=<query>`)
  - User can select an existing tag or create a new one by pressing Enter/comma
  - Tags are displayed as removable pills/chips below the input
  - Minimum 1 tag required, maximum 15 tags
  - Tags are normalized: lowercased, trimmed, spaces replaced with underscores, max 30 chars
- Validation: cannot proceed without at least one tag

**Step 7 — Review & Publish**
- Summary of all choices: notebook, visibility, title, description, content preview, tags
- "Publish" button that sends the request
- On success: redirect to the published notebook's community page or show a success screen

### 3.2 "Publish Now" Button Changes

The "Publish Now" button in `CommunitySidebar` currently links to `/dashboard`. Change it to navigate to `/publish` (the new wizard page).

### 3.3 API Changes for Publish

Modify `POST /api/notebooks/[id]/share` to accept the new fields:

```typescript
// Request body additions:
{
  type: "copy" | "live_view",
  visibility: "public" | "friends",
  title: string,           // required
  description?: string,    // optional short description
  content?: string,        // optional rich content (HTML/markdown)
  tags: string[],          // required, min 1
  // sharedWithIds still supported for "specific" visibility
}
```

The endpoint should:
1. Validate at least one tag is provided
2. For each tag: find existing `Tag` by normalized name, or create a new one
3. Create the `SharedNotebook` record with title, description, content
4. Create `SharedNotebookTag` join records
5. Create a `FriendActivity` record (type: "published") for the activity feed
6. Return the created share with tags

### 3.4 New Page: `/publish`

- Route: `app/(dashboard)/publish/page.tsx`
- Client component with step state management
- Stepper/progress bar at the top showing all 7 steps
- Back/Next navigation between steps
- Form state persisted across steps (React state, not URL params)
- The rich content editor (Step 5) should lazy-load TipTap to keep the bundle small

---

## 4. Tags System & Trending Tags

### 4.1 Tag Normalization Rules

When a user types a tag:
1. Trim whitespace
2. Convert to lowercase
3. Replace spaces with underscores
4. Remove special characters (keep alphanumeric, underscores, hyphens)
5. Max 30 characters
6. Prefix with `#` for display only (stored without `#`)

### 4.2 Tag Autocomplete API

**`GET /api/tags?search=<query>&limit=10`**

- Returns tags whose `name` starts with or contains the search query
- Ordered by total view count (most popular first) so popular tags appear at top
- Response: `{ tags: [{ id, name, totalViews }] }`

Implementation:
```sql
SELECT t.id, t.name, COALESCE(SUM(view_counts.count), 0) as totalViews
FROM tags t
LEFT JOIN shared_notebook_tags snt ON snt.tagId = t.id
LEFT JOIN (
  SELECT sharedNotebookId, COUNT(*) as count
  FROM notebook_views
  GROUP BY sharedNotebookId
) view_counts ON view_counts.sharedNotebookId = snt.sharedNotebookId
WHERE t.name LIKE '%<query>%'
GROUP BY t.id
ORDER BY totalViews DESC
LIMIT 10
```

In Prisma, this will require a raw query or a carefully structured aggregation.

### 4.3 Trending Tags Computation

**`GET /api/tags/trending?limit=8&period=7d`**

Algorithm:
1. Look at all `NotebookView` records created within the last `period` (default 7 days)
2. For each view, find the tags of the viewed `SharedNotebook`
3. Sum the view counts per tag
4. Return the top N tags sorted by total views descending

Response:
```json
{
  "tags": [
    { "id": "...", "name": "react_hooks", "viewCount": 1523 },
    { "id": "...", "name": "mcat_prep", "viewCount": 987 },
    ...
  ]
}
```

### 4.4 Trending Tag Click → Filtered Catalog

When a user clicks a trending tag, navigate to:
`/community?tag=<tag_name>`

This opens the catalog page (Section 8) pre-filtered to show notebooks with that tag, sorted by view count descending.

### 4.5 CommunitySidebar Changes

Replace the hardcoded `TRENDING_TAGS` array:
- Fetch from `GET /api/tags/trending?limit=4` on mount
- Show loading skeleton while fetching
- Each tag is a clickable link to `/community?tag=<tag_name>`
- Assign colors dynamically (rotate through a palette based on tag index/hash)

---

## 5. Real Download Counts & Ratings

### 5.1 Download Tracking

**`POST /api/community/notebooks/[shareId]/download`**

- Requires authentication
- Creates a `NotebookDownload` record (unique per user per share)
- Creates a `FriendActivity` record (type: "downloaded")
- Returns the updated download count
- If the user already downloaded, return success without creating a duplicate (upsert behavior via unique constraint)

The existing copy endpoint (`POST /api/notebooks/[id]/share/copy`) should also trigger a download record.

### 5.2 Rating System

**`POST /api/community/notebooks/[shareId]/rate`**

- Body: `{ value: 1-5 }`
- Creates or updates the user's `NotebookRating` for this share
- Creates a `FriendActivity` record (type: "rated") only on first rating
- Returns the updated average rating and total rating count

**`GET /api/community/notebooks/[shareId]`** (existing endpoint — extend)

- Include in response:
  - `downloadCount` (count of `NotebookDownload` records)
  - `averageRating` (avg of `NotebookRating.value`) — displayed as stars (e.g., 4.7 stars)
  - `ratingCount` (count of `NotebookRating` records) — displayed as "(X ratings)"
  - `viewCount` (count of `NotebookView` records) — displayed as "X viewers" with eye icon
  - `tags` (array of tag names)
  - `userRating` (the current user's rating, if any)
  - `userDownloaded` (boolean, whether current user downloaded)
- **Rating privacy:** Only the star average and rating count are public. Individual ratings (who rated what) are never exposed.

### 5.3 CommunityHub Changes

In `CommunityHub.tsx`, update the `fetchNotebooks` function:
- Remove the `Math.floor(Math.random() * 1000)` fake download count
- Remove the `Math.round((4 + Math.random()) * 10) / 10` fake rating
- Map the real `downloadCount` and `averageRating` from the API response
- The API (`GET /api/community/notebooks`) needs to be extended to include aggregate counts:

Update the community notebooks list endpoint to include:
```typescript
// In the select, add:
_count: { select: { downloads: true, ratings: true, views: true } }
// And compute average rating
```

Remove `MOCK_FEATURED` and `MOCK_LIBRARY` arrays entirely once real data is flowing.

---

## 6. View Count Tracking

### 6.1 When to Record a View

A view is recorded when a user opens/views a published notebook's detail page (`/community/[shareId]`).

**`POST /api/community/notebooks/[shareId]/view`**

- Called automatically when the detail page loads
- Creates a `NotebookView` record (unique per user per share — one view per user)
- Does not create a `FriendActivity` for views (too noisy)
- Returns `{ viewCount: number }`

### 6.2 View Count Display

Add view count to notebook cards in the community hub (alongside downloads and ratings). Display as an eye icon with the count, labeled as "X viewers" (e.g., "342 viewers") to communicate that this represents unique users who have viewed the notebook.

---

## 7. Friends Status Card — Real Data

### 7.1 Activity Feed API

**`GET /api/friends/activity?limit=4`**

Algorithm:
1. Get current user's accepted friend IDs
2. Query `FriendActivity` where `userId` is in the friend IDs list
3. Order by `createdAt` DESC, limit to 4
4. Join with `User` to get username, avatarUrl
5. Determine online status via WebSocket presence (see Section 7.4).

Response:
```json
{
  "activities": [
    {
      "id": "...",
      "username": "Alex Thompson",
      "avatarUrl": null,
      "activity": "Downloaded",
      "targetName": "Stoic Ethics Guide",
      "targetColor": "#a689ff",
      "targetId": "share_123",
      "timeAgo": "2 mins ago",
      "online": true
    }
  ]
}
```

### 7.2 Recording Activities

Activities are created as side effects of other actions:
- **Publishing** a notebook → `type: "published"`
- **Downloading** a notebook → `type: "downloaded"`
- **Rating** a notebook → `type: "rated"`

The activity record stores enough info for display without needing to re-query the source.

### 7.3 CommunitySidebar Changes

Replace the `fetchFriends` function:
- Fetch from `GET /api/friends/activity?limit=4` instead of `GET /api/friends?status=accepted`
- Remove the fake activity/notebook mapping (`['Downloaded', 'Created', 'Completed', 'Updated'][i % 4]`)
- Map the real activity data directly
- Remove `MOCK_FRIENDS` array entirely once real data is flowing
- Keep the mock as a fallback only if the API fails AND there are no activities

### 7.4 "See All" Link

Change from `/dashboard` to a page that shows the full friend activity feed (could be `/friends/activity` or a section within the existing friends page).

### 7.5 Real-Time Online Presence (WebSocket)

Implement real-time presence tracking so the friends card shows accurate online/offline status.

**Server-side: WebSocket presence server**

- Set up a WebSocket server (using `ws` or Socket.IO) alongside the Next.js app
- On connect: client sends auth token, server validates and registers the user as "online"
- Server maintains an in-memory `Map<userId, Set<WebSocket>>` of active connections
- On disconnect: remove the connection; if the user has no remaining connections, mark as "offline"
- Heartbeat: clients send a ping every 30s; server drops connections that miss 2 consecutive heartbeats
- Expose a REST endpoint or internal function `getOnlineUserIds(userIds: string[]): string[]` that other API routes can call to check presence

**New Prisma field (optional fallback):**

```prisma
// Add to User:
  lastSeenAt   DateTime?  // Updated on WS connect/heartbeat, used as fallback if WS server is down
```

**Client-side: presence hook**

- `usePresence()` hook that:
  - Connects to the WS server on mount (authenticated)
  - Sends heartbeats every 30s
  - Listens for `presence:update` events (friend came online/went offline)
  - Exposes `onlineFriendIds: Set<string>` reactive state
- The `CommunitySidebar` friends card subscribes to this hook to show green/grey dots in real time

**Presence event flow:**
1. User A opens the app → WS connect → server adds A to online set
2. Server checks A's friends list, finds friends B and C are online
3. Server sends `presence:update { online: [B.id, C.id] }` to A
4. Server sends `presence:update { online: [A.id] }` to B and C (A just came online)
5. User A closes tab → WS disconnect → server removes A
6. Server sends `presence:update { offline: [A.id] }` to B and C

**Integration with friends activity API:**
- `GET /api/friends/activity` response includes an `online` boolean per friend
- This is computed by checking the WS presence map (or falling back to `lastSeenAt < 2 min ago`)

---

## 8. Notebook Catalog Page ("View All")

### 8.1 New Route: `/community`

- Route: `app/(home)/community/page.tsx` (or `app/(dashboard)/community/page.tsx` — whichever layout group makes more sense with the current nav)
- Full catalog page for browsing all published notebooks

### 8.2 Page Layout

**Header Section:**
- Page title: "Community Library" or "Notebook Catalog"
- Search bar (searches notebook title, description, author name, tags)
- Filter controls (see below)

**Preset Sections (above the grid):**
- **Trending Notebooks** — horizontal scroll of top notebooks by view count in last 7 days
- **Most Downloaded** — horizontal scroll of top notebooks by download count all-time
- **Recently Published** — horizontal scroll of newest publications

**Main Grid:**
- Paginated grid of notebook cards (similar to existing `LibraryCard` component)
- Each card shows: title, description, subject, author, download count, average rating, view count, tags
- Click a card → navigate to `/community/[shareId]` (existing route)

### 8.3 Filtering & Sorting

**Filters (sidebar or top bar):**
- **Tag filter**: multi-select tag chips (populated from trending + search)
- **Subject filter**: dropdown of available subjects
- **Visibility**: "All" | "Public" | "Friends"
- **Date range**: "All time" | "This week" | "This month"

**Sort options:**
- Most viewed (default when coming from trending tag click)
- Most downloaded
- Highest rated
- Newest
- Oldest

**Search:**
- Full-text search across title, description, and tags
- Debounced input (300ms)
- Results update the main grid

### 8.4 URL-Based State

All filter/sort/search state should be reflected in URL query params:
- `/community?tag=react_hooks&sort=views&period=week`
- This allows sharing links and back-button navigation
- When arriving from a trending tag click, the `tag` param is pre-set

### 8.5 API: Extend `GET /api/community/notebooks`

Add new query params:
- `tag` — filter by tag name (comma-separated for multiple)
- `sort` — `views` | `downloads` | `rating` | `newest` | `oldest`
- `period` — `week` | `month` | `all` (for trending calculations)
- Existing params (`search`, `subject`, `filter`, `page`, `limit`) remain

The endpoint response should be extended to include:
```typescript
{
  notebooks: [{
    shareId, notebookId, name, subject, color, sectionCount,
    shareType, visibility, title, description,
    author: { id, username, avatarUrl },
    sharedAt,
    // NEW fields:
    downloadCount: number,
    averageRating: number,
    ratingCount: number,
    viewCount: number,
    tags: string[],
  }],
  total, page, limit, totalPages
}
```

### 8.6 "View All" Button Fix

In `CommunityHub.tsx`, change the "View All" button from a no-op to:
```tsx
<Link href="/community">View All</Link>
```

---

## 9. Home Page Integration

### 9.1 CommunityHub Changes Summary

1. **Remove all mock data** (`MOCK_FEATURED`, `MOCK_LIBRARY`)
2. **Update `fetchNotebooks`** to use real download counts, ratings, view counts, and tags from the API
3. **"Most Downloaded This Week"** section: fetch with `sort=downloads&period=week&limit=4`
4. **"Library Explorer"** section: fetch with `sort=newest&limit=5` (or whichever filter tab is active)
5. **"View All" button**: navigate to `/community`
6. **Notebook cards**: display real metrics (downloads, rating, views)
7. **Card click**: navigate to `/community/[shareId]`

### 9.2 CommunitySidebar Changes Summary

1. **"Publish Now" button**: navigate to `/publish`
2. **Friends Status card**: fetch from `GET /api/friends/activity?limit=4`, display real activities
3. **Trending Tags card**: fetch from `GET /api/tags/trending?limit=4`, display real trending tags with click-through to `/community?tag=<name>`
4. **Remove all mock data** (`MOCK_FRIENDS`, `TRENDING_TAGS`)

---

## 10. API Endpoints Summary

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tags?search=&limit=` | Tag autocomplete for publish flow |
| `GET` | `/api/tags/trending?limit=&period=` | Trending tags for sidebar |
| `POST` | `/api/community/notebooks/[shareId]/download` | Record a download |
| `POST` | `/api/community/notebooks/[shareId]/rate` | Rate a notebook (1-5) |
| `POST` | `/api/community/notebooks/[shareId]/view` | Record a view |
| `GET` | `/api/friends/activity?limit=` | Friend activity feed |

### Modified Endpoints

| Method | Path | Changes |
|--------|------|---------|
| `POST` | `/api/notebooks/[id]/share` | Accept `tags[]`, `content`, require title & tags for community shares |
| `GET` | `/api/community/notebooks` | Add `tag`, `sort`, `period` params; include download/rating/view counts and tags in response |
| `GET` | `/api/community/notebooks/[shareId]` | Include full metrics, tags, and user-specific state (rated?, downloaded?) |

### New Pages

| Path | Purpose |
|------|---------|
| `/publish` | 7-step publish wizard |
| `/community` | Full notebook catalog with search/filter/sort |

---

## 11. Migration & Rollout Order

Implementation should proceed in this order to avoid breaking changes:

### Phase 1: Database & Schema
1. Create Prisma migration with all new models (`Tag`, `SharedNotebookTag`, `NotebookDownload`, `NotebookRating`, `NotebookView`, `FriendActivity`)
2. Add new fields to `SharedNotebook` (`content`, relations)
3. Add new relations to `User`
4. Run migration

### Phase 2: Core APIs (no UI changes yet)
5. Implement `GET /api/tags` (autocomplete)
6. Implement `GET /api/tags/trending`
7. Implement `POST /api/community/notebooks/[shareId]/download`
8. Implement `POST /api/community/notebooks/[shareId]/rate`
9. Implement `POST /api/community/notebooks/[shareId]/view`
10. Implement `GET /api/friends/activity`
11. Extend `POST /api/notebooks/[id]/share` with tags & content support
12. Extend `GET /api/community/notebooks` with new params and response fields
13. Extend `GET /api/community/notebooks/[shareId]` with metrics

### Phase 3: Publish Wizard
14. Create `/publish` page with the 7-step wizard
15. Build tag input component with autocomplete
16. Build rich content editor (TipTap) for step 5
17. Update "Publish Now" button in `CommunitySidebar` to link to `/publish`

### Phase 4: Catalog Page
18. Create `/community` page with search, filters, sorting
19. Wire up "View All" button in `CommunityHub`
20. Add view tracking call to `/community/[shareId]` page

### Phase 5: Home Page Real Data
21. Update `CommunityHub` to use real data (remove mock arrays)
22. Update `CommunitySidebar` friends card to use `GET /api/friends/activity`
23. Update `CommunitySidebar` trending tags to use `GET /api/tags/trending`
24. Remove all mock data arrays

### Phase 6: WebSocket Presence
25. Set up WebSocket server (alongside Next.js app)
26. Implement server-side presence tracking (online map, heartbeat, friend broadcast)
27. Build `usePresence()` client hook
28. Integrate presence data into friends status card
29. Add `lastSeenAt` fallback field to User model

### Phase 7: Polish
30. Add loading skeletons for new data fetching
31. Add empty states (no trending tags yet, no friend activity, etc.)
32. Error handling and fallbacks
33. Test the full publish → view → download → rate → trending pipeline end-to-end

---

## Confirmed Decisions

| Question | Decision |
|----------|----------|
| Publish flow UI | Full page (`/publish`), not a modal |
| Rich content editor | TipTap (already in project), stored as HTML |
| View uniqueness | One view per user per notebook (unique users, not sessions) |
| View display | "X viewers" with eye icon |
| Rating privacy | Only star average + rating count visible; no individual ratings exposed |
| Online status | Real-time WebSocket presence (not timestamp-based MVP) |
| Tag limits | Max 15 tags per publication, max 30 chars per tag |
