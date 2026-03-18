# Design System Documentation

## 1. Overview & Creative North Star: "The Neon Scholar"
This design system is built to bridge the gap between high-velocity productivity and the engaging, tactile warmth of gamified learning. Our Creative North Star is **"The Neon Scholar."** This aesthetic rejects the sterile, flat "SaaS-standard" look in favor of an editorial, dark-mode experience that feels premium and authoritative yet deeply accessible.

By combining the expressive, condensed personality of **Shrikhand** with the rounded, approachable utility of **Gliker**, we create a UI that breathes. We move beyond the "grid-of-boxes" by employing intentional asymmetry, tonal layering, and sophisticated depth. This is not just a tool; it is a digital study sanctum.

---

## 2. Colors & Surface Philosophy
The palette is a sophisticated interplay of deep cosmic indigos and vibrant, neon-inflected accents. We do not use color just for decoration; we use it to define the hierarchy of thought.

### Key Tokens
*   **Primary (`#ae89ff`):** Our signature purple. Use for high-intent actions and primary brand moments.
*   **Secondary (`#b9c3ff`):** A soft, periwinkle blue for supportive UI elements and accents.
*   **Tertiary/Highlight (`#ffde59`):** Our "Magic" color. Reserved for success states, streaks, and CTA buttons that demand immediate attention.
*   **Surface (`#0d0d1a`):** The foundational dark page background.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off the UI. 
*   **Boundary Definition:** Contrast must be achieved through background shifts. For example, a sidebar using `surface_container_low` sits flush against the `surface` background. 
*   **Tonal Transitions:** Use spacing and subtle color value changes (e.g., `surface` to `surface_container`) to define where one thought ends and another begins.

### Glass & Gradient Soul
*   **Signature Textures:** Main CTAs should not be flat. Apply a subtle linear gradient from `primary` to `primary_container` (at a 135° angle) to provide a "lit from within" glow.
*   **Glassmorphism:** For floating menus or overlays, use a semi-transparent `surface_variant` with a 20px `backdrop-blur`. This ensures the UI feels integrated into a physical space rather than layered on top of it.

---

## 3. Typography
Our typography is a conversation between flair and function.

*   **Display & Headlines (Shrikhand):** This is our "Editorial Voice." It is bold, italicized, and condensed. Use it sparingly for top-level headers (`display-lg` to `headline-sm`) to inject personality and a sense of "magic."
*   **UI & Body (Gliker/Plus Jakarta Sans):** For the workhorse text—labels, body copy, and inputs—we use rounded, highly legible sans-serifs. This balances the intensity of Shrikhand with a "friendly professional" tone.

**Hierarchy Note:** 
Always pair a `Shrikhand` headline with a `body-md` description. The contrast in character—one expressive and condensed, the other open and rounded—creates a sophisticated, high-end editorial rhythm.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are a fallback, not a feature. We build depth through **Tonal Layering**.

*   **The Layering Principle:** Treat the UI as stacked sheets.
    *   **Level 0:** `surface_dim` (The base).
    *   **Level 1:** `surface_container_low` (Sidebars or main content areas).
    *   **Level 2:** `surface_container` (Cards or interactive modules).
    *   **Level 3:** `surface_container_highest` (Active states or modals).
*   **Ambient Shadows:** If a floating element requires a shadow, use a large blur (32px+) with 6% opacity. The shadow color should be a deep purple tint (derived from `on_surface`) rather than black.
*   **The "Ghost Border":** For essential accessibility in forms, use the `outline_variant` token at 15% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** `primary` background with `on_primary` text. 12px border radius. Apply a subtle inner-glow on hover.
*   **Secondary:** `surface_container_high` background. No border. Soft rounded corners.
*   **CTA (Yellow):** `tertiary` background. Reserved for "Finish Quiz" or "Upgrade." This is the highest-contrast element in the system.

### Cards & Lists
*   **Rule:** Never use dividers. 
*   **Structure:** Use `spacing-4` (1.4rem) between list items. Separate different groups of content by shifting from `surface_container` to `surface_container_low`.
*   **Interactive Cards:** 16px (`xl`) border radius for a friendly, approachable feel.

### Input Fields
*   **State:** Use `surface_variant` for the field background. On focus, the background remains the same, but the "Ghost Border" increases to 40% opacity in the `primary` color.
*   **Validation:** Error states use `error_dim` text—never a harsh red.

### Specialized Study Components
*   **Progress Orbs:** Use `secondary` for the track and a `primary-to-tertiary` gradient for the fill to signify growth.
*   **Flashcard Stacks:** Use Tonal Layering (Level 1, 2, and 3) to show a "stack" of cards peeking from behind the active one.

---

## 6. Do's and Don'ts

### Do
*   **Do** use generous whitespace (`spacing-8` or higher) between major sections to let the dark theme "breathe."
*   **Do** use `outline-iconography` with rounded caps and joins to match the Gliker typeface.
*   **Do** lean into asymmetry. A header can be left-aligned while a sub-module is slightly inset to create visual interest.

### Don't
*   **Don't** use 100% white (#FFFFFF) for text. Use `on_background` (#e5e3ff) to reduce eye strain in the dark environment.
*   **Don't** use sharp 90-degree corners. Everything must feel "held" and safe, adhering to the 8px/12px/16px radius scale.
*   **Don't** use standard grey shadows. Shadows must always be tinted with the system's indigo/purple hues to maintain the "Neon Scholar" atmosphere.