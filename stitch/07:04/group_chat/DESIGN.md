# Design System Specification: Editorial Dark Mode for Learning

## 1. Overview & Creative North Star
This design system is built upon the North Star of **"The Intellectual Luminary."** We are moving away from the "gamified" clutter of traditional educational platforms and toward a high-end, editorial experience. It balances the depth of a late-night study session with the electric energy of a breakthrough.

The layout strategy relies on **intentional asymmetry** and **tonal depth**. Rather than rigid, boxed-in grids, we use breathing room and layering to guide the eye. This system is designed to feel like a premium digital notebook—sophisticated, focused, and deeply immersive.

---

## 2. Colors: Tonal Depth & Radiant Accents
We use a deep, obsidian-inspired palette to minimize eye strain and maximize the impact of our primary "Radiant Purple" and secondary "Action Yellow."

### The "No-Line" Rule
To maintain a high-end feel, **do not use 1px solid borders for sectioning.** Boundaries must be defined by background color shifts.
*   A card (`surface-container-low`) should sit on a background (`surface`) to define its edge. 
*   Separation is achieved through contrast, not strokes.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each "step" closer to the user should be represented by a shift in the surface token:
*   **Base:** `surface` (#0b0e14)
*   **Lower Sectioning:** `surface-container-low` (#10131a)
*   **Standard Cards:** `surface-container` (#161a21)
*   **Elevated/Interactive:** `surface-container-high` (#1c2028)

### The Glass & Gradient Rule
Floating elements or high-priority modals should utilize **Glassmorphism**. Use semi-transparent surface colors (e.g., `primary` at 15% opacity) with a `backdrop-blur` of 12px to 20px. 
*   **Signature Textures:** Apply subtle linear gradients (e.g., `primary` to `primary-container`) on hero elements and main CTAs to give the interface a "soul" and a sense of movement.

---

## 3. Typography: Editorial Authority
We utilize a dual-font system to create a sophisticated hierarchy between brand-led headings and high-utility body text.

*   **Display & Headlines:** `Plus Jakarta Sans`. This typeface provides a modern, geometric feel with an open aperture, perfect for large-scale headers (`display-lg` to `headline-sm`).
*   **Body & Labels:** `Manrope`. Chosen for its exceptional legibility at small sizes. Its clean, sans-serif structure ensures that educational content—no matter how dense—remains accessible.

**Visual Hierarchy Tip:** Use `on-surface-variant` (#a9abb3) for secondary metadata to create a natural typographic recession, allowing `on-surface` titles to command the most attention.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too heavy for this dark aesthetic. We use light and transparency to simulate depth.

*   **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container-low` section to create a soft, natural "recessed" look.
*   **Ambient Shadows:** For floating elements, use extra-diffused shadows (Blur: 30px-40px) at a very low opacity (4%-8%). The shadow color should be a tinted version of `primary` or `on-surface` rather than pure black.
*   **The "Ghost Border" Fallback:** If accessibility requirements demand a border, use the `outline-variant` token (#45484f) at **20% opacity**. This creates a "Ghost Border" that defines shape without adding visual noise.
*   **Radii Scale:** Use `md` (0.75rem / 12px) for primary containers and cards to maintain the "soft-modern" feel. Use `full` (9999px) exclusively for pills and chips.

---

## 5. Components

### Buttons
*   **Primary (Action):** Use `secondary` (#fdd400) with `on-secondary` (#594a00) text. This high-contrast pairing is reserved for the most critical actions (e.g., "Publish Now").
*   **Secondary:** Use `primary` (#b6a0ff) or a `primary-container` gradient. Use `sm` (0.25rem) or `full` rounding.
*   **Tertiary (Ghost):** No background. `on-surface` text. Use a `surface-variant` hover state.

### Cards & Lists
*   **Prohibition:** Never use divider lines. 
*   **Separation:** Use `8px` to `16px` of vertical white space or a shift from `surface-container` to `surface-container-high` to distinguish between list items.

### Chips
*   **Selection:** Use `surface-container-highest` backgrounds with `on-surface` text. On active states, transition to `primary-dim` with a `primary` subtle glow.

### Input Fields
*   **Styling:** Use `surface-container-low` for the field background. 
*   **States:** On focus, use a `primary` "Ghost Border" (20% opacity) and a subtle 2px glow. Avoid heavy solid strokes.

### Study Progress (Contextual Component)
*   Use a "Glass" progress bar. A background of `surface-variant` with a `primary` gradient fill that has a subtle outer glow to simulate a "neon" light-tube effect.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use `primary` gradients for major feature blocks (like the "Share Your Notebook" card) to create visual focal points.
*   **Do** prioritize `surface-container` shifts over lines to define your layout.
*   **Do** use `Plus Jakarta Sans` at high weights (Bold/ExtraBold) for headlines to establish an editorial voice.

### Don't:
*   **Don't** use 100% white (#FFFFFF) for text. Use `on-surface` (#ecedf6) to reduce contrast-induced eye fatigue.
*   **Don't** use sharp 0px corners. This breaks the "High-End" approachable feel. Stick to the `8-12px` range.
*   **Don't** use pure black backgrounds. The `surface` token (#0b0e14) provides the necessary depth while allowing shadows and glows to remain visible.
*   **Don't** clutter the screen with icons. Let the typography and spacing do the heavy lifting.