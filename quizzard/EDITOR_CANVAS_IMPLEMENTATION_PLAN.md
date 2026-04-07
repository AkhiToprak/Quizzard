# Editor Extensions & Infinite Canvas

Add callout blocks, toggle/dropdown headers to the TipTap editor, and introduce an infinite canvas as a new file type alongside the existing text editor pages.

## User Review Required

> [!IMPORTANT]
> **Infinite Canvas library choice**: I plan to use a library like **tldraw** (or a custom `<canvas>`-based solution). tldraw is a full-featured open-source canvas that's React-friendly and supports text, shapes, freeform drawing, connectors, etc. If you prefer a specific library (e.g., Excalidraw, ReactFlow) or want a fully custom canvas, let me know.

> [!IMPORTANT]
> **Canvas data storage**: The infinite canvas state will be stored as JSON in the existing `content` column on the `Page` model (same column used for TipTap JSON). A new `pageType` field will distinguish between `"text"` and `"canvas"` pages. This requires a Prisma migration.

> [!WARNING]
> **Breaking change for existing pages**: The migration will add a `pageType` column with a default of `"text"`, so all existing pages will be unaffected. No data loss.

---

## Proposed Changes

### [x] Phase 1 — Callout Block Extension

A callout is a styled block (like Notion's callout or GitHub's alert boxes) with an icon + colored background. Users can insert callouts of types: info, warning, success, tip.

#### [x] [NEW] [tiptap-callout.ts](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/lib/tiptap-callout.ts)

- Custom TipTap `Node` extension (`type: "callout"`)
- Attributes: `calloutType` (`"info"` | `"warning"` | `"success"` | `"tip"`)
- Renders as a `<div>` with an emoji icon + colored left border
- Supports wrapping selected content or inserting an empty callout
- Commands: `setCallout({ type })`, `toggleCallout({ type })`, `unsetCallout()`

#### [x] [NEW] [CalloutView.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/CalloutView.tsx)

- React `NodeView` component for rendering callouts in the editor
- Type selector dropdown to switch callout type
- Styled with the existing Neon Scholar design system colors

#### [x] [MODIFY] [PageEditor.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/PageEditor.tsx)

- Register the `Callout` extension in the `extensions` array
- Add callout CSS styles to the editor stylesheet

#### [x] [MODIFY] [EditorToolbar.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/EditorToolbar.tsx)

- Add a callout dropdown button to toolbar Row 2 (block formatting row)
- Lucide icon: `MessageSquareWarning` or `AlertCircle`
- Dropdown shows 4 callout types with colored preview swatches

---

### [x] Phase 2 — Toggle/Dropdown Headers Extension

A toggle header is a collapsible block — click the header to expand/collapse its content (like Notion's toggle list). Users can create H1/H2/H3 toggles.

#### [x] [NEW] [tiptap-toggle-heading.ts](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/lib/tiptap-toggle-heading.ts)

- Custom TipTap `Node` extension (`type: "toggleHeading"`)
- Attributes: `level` (1 | 2 | 3), `collapsed` (boolean, default `false`)
- Structure: a `<details>` wrapper with `<summary>` for the heading and nested content
- Commands: `setToggleHeading({ level })`, `toggleToggleHeading({ level })`

#### [x] [NEW] [ToggleHeadingView.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/ToggleHeadingView.tsx)

- React `NodeView` rendering a clickable header with a chevron/caret icon
- Clicking toggles content visibility with a smooth animation
- Content area accepts arbitrary TipTap content (paragraphs, lists, code, etc.)

#### [x] [MODIFY] [PageEditor.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/PageEditor.tsx)

- Register `ToggleHeading` extension
- Add toggle heading CSS styles

#### [x] [MODIFY] [EditorToolbar.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/EditorToolbar.tsx)

- Add a "Toggle" dropdown in toolbar Row 2 near the existing H1/H2/H3 buttons
- Lucide icon: `ChevronRight` or `ListCollapse`
- Dropdown shows Toggle H1, Toggle H2, Toggle H3

---

### [x] Phase 3 — Database & Page Type Infrastructure

Add `pageType` field to distinguish text pages from canvas pages.

#### [x] [MODIFY] [schema.prisma](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/prisma/schema.prisma)

- Add `pageType String @default("text")` to the `Page` model
  - Values: `"text"` (TipTap editor) or `"canvas"` (infinite canvas)
- Run `npx prisma migrate dev` to create migration (completed via raw SQL)

#### [x] [MODIFY] Page creation API route

- Accept optional `pageType` parameter (defaults to `"text"`)
- Pass `pageType` through to `prisma.page.create()`

#### [x] [MODIFY] Page fetch API route

- Return `pageType` in the response so the frontend knows which editor to render

---

### [x] Phase 4 — Infinite Canvas

Introduce a canvas-based page type with free-form spatial content (text blocks, shapes, drawings, sticky notes, connectors).

#### [x] [NEW] [InfiniteCanvas.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/InfiniteCanvas.tsx)

- Main canvas editor component powered by **tldraw** (or alternative based on your preference)
- Auto-saves canvas state as JSON to the `content` column (same auto-save pattern as `PageEditor`)
- Includes title input and save status indicator (reusing existing patterns)
- Styled to match the Neon Scholar dark theme

#### [x] [MODIFY] Page display router (notebook page component)

- Conditionally render `<PageEditor>` for `pageType === "text"` or `<InfiniteCanvas>` for `pageType === "canvas"`

#### [x] [MODIFY] [UnifiedSidebar.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/UnifiedSidebar.tsx)

- When creating a new page, show a small selection UI (modal or inline toggle) to choose between:
  - 📝 **Text Page** — standard TipTap editor (default)
  - 🎨 **Canvas** — infinite canvas
- Different icon in sidebar for canvas pages vs text pages

#### [x] [NEW] [PageTypeSelector.tsx](file:///Users/toprakdemirel/Entwicklung/Quizzard/quizzard/src/components/notebook/PageTypeSelector.tsx)

- Small modal/popover component with two cards to choose page type
- Shown when user clicks "New Page" button
- Clean design with icons and brief descriptions

---

## Verification Plan

### Manual Verification

Since there are no existing automated tests in the project, the verification will be manual. After each phase:

**Phase 1 — Callouts:**

1. Open the app at `localhost:3000`, navigate to any notebook → section → page
2. In the editor toolbar, find and click the new Callout button
3. Verify all 4 types render correctly (info=blue border, warning=orange, success=green, tip=purple)
4. Type inside the callout, verify content is saved on reload
5. Use the type selector to switch callout types and verify style changes
6. Verify callout data persists after page refresh

**Phase 2 — Toggle Headers:**

1. In the toolbar, click the Toggle dropdown and select Toggle H1
2. Verify an expandable heading block appears with a chevron icon
3. Type a heading title and content below it
4. Click the chevron/heading to collapse → content should hide with animation
5. Click again to expand → content should reappear
6. Save, refresh, and verify collapsed/expanded state persists
7. Test nesting: add a toggle inside another toggle's content

**Phase 3 — Schema Migration:**

1. Run `npx prisma migrate dev` and verify migration succeeds
2. Verify existing pages still load correctly (should all have `pageType: "text"`)
3. Check API response includes `pageType` field

**Phase 4 — Infinite Canvas:**

1. In the sidebar, click "New Page" → verify the page type selector appears
2. Choose "Text Page" → verify existing TipTap editor opens (no regression)
3. Choose "Canvas" → verify the infinite canvas editor loads
4. On the canvas: add text, draw shapes, move items around
5. Wait for auto-save, refresh page → verify canvas state is preserved
6. Verify canvas pages show a different icon in the sidebar
7. Navigate between text and canvas pages to verify clean switching
