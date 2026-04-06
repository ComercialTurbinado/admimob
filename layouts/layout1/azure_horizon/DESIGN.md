# Design System Specification: The Architectural Perspective

## 1. Overview & Creative North Star
**Creative North Star: "The Curated Estate"**

This design system rejects the "cookie-cutter" real estate template in favor of a high-end editorial experience. We are not just listing properties; we are curating lifestyles. The aesthetic is defined by **Organic Professionalism**—a blend of structural rigidity (Deep Blue) and fluid, airy layouts. 

To break the "standard" UI look, we utilize **Intentional Asymmetry**. Hero sections should feature overlapping elements—such as a property image bleeding into a `surface-container-highest` content block—to create a sense of architectural depth. We favor generous white space over density, treating every screen like a page in a premium architectural magazine.

---

## 2. Colors & Surface Philosophy
Our palette is rooted in a foundation of trust, utilizing deep oceanic blues and sophisticated slates, punctuated by a "Living Teal" tertiary accent.

### The "No-Line" Rule
**Borders are prohibited for structural sectioning.** Boundaries must be defined solely through background shifts. 
*   **Implementation:** Place a `surface-container-low` section directly against a `surface` background. The shift in tone is enough to signal a new content area without the "grid-trap" visual clutter of lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Lowest Level:** `surface` (#f7f9fb) – The base canvas.
*   **Interactive Level:** `surface-container-low` (#f2f4f6) – Used for secondary content areas.
*   **Elevated Level:** `surface-container-lowest` (#ffffff) – Reserved for primary cards or focal points to make them "pop" against the canvas.
*   **Deep Level:** `primary` (#002045) – Used for high-contrast footers or immersive headers.

### The "Glass & Gradient" Rule
To inject "soul" into the professional aesthetic:
*   **Glassmorphism:** Use `surface_variant` at 60% opacity with a `20px` backdrop blur for floating navigation bars or mobile filters.
*   **Signature Gradients:** For primary CTAs and Hero backgrounds, use a subtle linear gradient transitioning from `primary` (#002045) to `primary_container` (#1a365d) at a 135-degree angle. This adds a "weighted" premium feel that flat hex codes cannot achieve.

---

## 3. Typography: The Editorial Voice
We utilize a dual-sans-serif approach to balance architectural strength with functional clarity.

*   **Display & Headlines (Manrope):** Our "Voice." Large, bold, and authoritative. Use `display-lg` for property titles with a negative letter-spacing of `-0.02em` to feel tighter and more "designed."
*   **Titles & Body (Manrope):** Our "Narrative." Clean and highly legible. Use `title-lg` for section headers and `body-lg` for property descriptions.
*   **Labels (Inter):** Our "Utility." Used for data points (sq ft, price, coordinates). Inter’s neutral, technical character provides a functional contrast to the more expressive Manrope.

**Hierarchy Note:** Always maintain a minimum 2-step jump in the scale between a headline and a sub-headline to ensure a clear "Editorial Path."

---

## 4. Elevation & Depth
In "The Curated Estate," depth is felt, not seen.

*   **The Layering Principle:** Avoid shadows where tonal layering suffices. A `#ffffff` card on a `#f2f4f6` background is the preferred method for defining objects.
*   **Ambient Shadows:** When a float is required (e.g., a "Contact Agent" FAB), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 32, 69, 0.06);`. Notice the shadow is tinted with the `primary` color, not black.
*   **The Ghost Border Fallback:** For input fields or cards on a white background, use the `outline_variant` at **15% opacity**. This creates a "suggestion" of a container rather than a hard cage.

---

## 5. Components

### Buttons (The "Call to Action")
*   **Primary:** A gradient of `primary` to `primary_container`. Radius: `md` (0.375rem). High-contrast white text.
*   **Tertiary (The Vibrant Accent):** Use `tertiary_container` (#003d37) with `on_tertiary_container` (#3cafa2) text for "New Listing" or "Special Offer" tags to draw immediate attention without breaking the professional blue core.

### Cards & Property Lists
*   **Rule:** Forbid divider lines. 
*   **Spacing:** Use `spacing-6` (2rem) to separate property cards.
*   **Layout:** Property images should use the `lg` (0.5rem) roundedness scale. Content within the card should be nested in a `surface-container-lowest` block that slightly overlaps the image.

### Search & Filter (Mobile-First)
*   **Inputs:** Use `surface_container_highest` for the input background. No border. On focus, transition to a `ghost-border` using the `primary` color at 20%.
*   **Chips:** Use `secondary_container` with `md` roundedness for active filters.

### Interactive "Glass" Map
*   When viewing property maps, the "List View" toggle should be a floating glassmorphic container (`surface` at 70% opacity + blur) to keep the user immersed in the map's geography.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical margins. If the left margin is `spacing-4`, try a `spacing-8` right margin for large-screen headlines to create an editorial feel.
*   **Do** use `on_surface_variant` (#43474e) for secondary text to reduce visual weight and improve hierarchy.
*   **Do** leverage `primary_fixed` (#d6e3ff) for subtle "call-out" boxes in property descriptions.

### Don’t:
*   **Don’t** use a 1px solid border to separate sections. Use a background color shift.
*   **Don’t** use pure black (#000000) for text. Use `on_surface` (#191c1e) to maintain a sophisticated, soft-touch readability.
*   **Don’t** use the `full` (pill) roundedness for primary buttons; it feels too "playful." Stick to `md` or `lg` for a more structural, architectural appearance.
*   **Don’t** crowd the edges. On mobile, ensure a minimum of `spacing-4` (1.4rem) horizontal padding for all containers.