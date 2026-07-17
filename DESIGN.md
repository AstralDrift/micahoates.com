# micahoates.com Design System

## 1. Atmosphere & Identity

An industrial command surface — precise, quiet authority, instrument clarity. The site feels like a calibrated operating console, not a marketing landing page and not a neon hacker terminal.

The signature is the brand name as a hero-level signal over a full-bleed atmospheric field of cool metal gradients and sparse filament apparatus. Interaction is deliberate: brand surface first, deeper keyboard interface second.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | --surface-primary | — | #0B0D10 | Main background |
| Surface/secondary | --surface-secondary | — | #12151A | Brand panels, work section |
| Surface/elevated | --surface-elevated | — | #181C22 | Terminal panel, palette |
| Text/primary | --text-primary | — | #E8E6E1 | Brand, body, terminal input |
| Text/secondary | --text-secondary | — | #9A9690 | Supporting copy |
| Text/tertiary | --text-tertiary | — | #5F5C57 | Labels, hints, chrome |
| Border/default | --border-default | — | #2A2E35 | Dividers, instrument rules |
| Border/subtle | --border-subtle | — | #1C2026 | Soft separations |
| Accent/primary | --accent-primary | — | #C4A574 | CTAs, focus, terminal accent |
| Accent/hover | --accent-hover | — | #D4B888 | Hover / active accent |
| Accent/steel | --accent-steel | — | #8FA8BC | Secondary instrument signal |
| Status/warning | --status-warning | — | #C9A66B | Caution lines |
| Status/error | --status-error | — | #C98989 | Errors |

Legacy aliases (quiet interface): `--bg` = surface-primary, `--text` = text-primary, `--muted` = text-tertiary, `--soft` = text-secondary, `--green` = accent-primary, `--cyan` = accent-steel, `--warn` = status-warning, `--error` = status-error, `--line` / `--line-strong` derived from borders/accent.

### Rules
- Site is dark by design (systems console). Do not invent a light theme.
- Accent is for interactive elements and terminal signal only — not decorative glow soup.
- No CRT neon green as identity. No purple gradients.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | clamp(2.75rem, 7vw, 5rem) | 500 | 1.05 | -0.03em | Brand name |
| H1 | clamp(1.5rem, 3vw, 2rem) | 500 | 1.2 | -0.02em | Hero headline |
| H2 | 1.25rem | 500 | 1.3 | -0.01em | Section headers |
| Body/lg | 1.125rem | 400 | 1.55 | 0 | Hero supporting line |
| Body | 1rem | 400 | 1.55 | 0 | Default |
| Body/sm | 0.875rem | 400 | 1.5 | 0.01em | Work descriptions |
| Caption | 0.75rem | 500 | 1.4 | 0.06em | Instrument labels (mono) |
| Overline | 0.6875rem | 500 | 1.3 | 0.12em | Section overlines (mono, uppercase) |

### Font Stack
- Primary (display/body): Space Grotesk via `next/font`
- Mono (instruments/terminal): IBM Plex Mono via `next/font`

### Rules
- Max 2 families.
- Brand name uses display scale; never smaller than the headline.
- Terminal chrome and overlines use mono.

## 4. Spacing & Layout

### Base Unit
All spacing derives from a base of **4px**.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tight |
| --space-2 | 8px | Compact |
| --space-3 | 12px | Default compact |
| --space-4 | 16px | Standard |
| --space-5 | 20px | Comfortable |
| --space-6 | 24px | Group padding |
| --space-8 | 32px | Between groups |
| --space-10 | 40px | Section inner |
| --space-12 | 48px | Section breaks |
| --space-16 | 64px | Page rhythm |
| --space-20 | 80px | Hero padding |
| --space-24 | 96px | Major separation |

### Grid
- Max content width: 72rem (1152px)
- Breakpoints: sm 640px, md 768px, lg 1024px
- Brand hero: full viewport height, edge-to-edge atmosphere
- Work section: single column instrument list, max-width 42rem

### Rules
- No card grids in the hero.
- Work entries are rows separated by hairline rules, not cards.

## 5. Components

### BrandSurface
- **Structure**: full-bleed atmosphere + brand + headline + support + CTA group
- **States**: default; CTAs have hover/focus/active
- **Accessibility**: landmark `header`/`main`; CTAs are real buttons/links with visible focus
- **Motion**: atmosphere idle (opacity/transform only); reduced-motion freezes idle

### SelectedWork
- **Structure**: overline + heading + list of work rows (name, blurb, optional external link)
- **States**: row hover/focus shifts border accent
- **Accessibility**: list semantics; links have clear names
- **Motion**: micro border/color transition (150–200ms)

### QuietTerminal (interface mode)
- **Structure**: chrome + scrollback + command form; palette overlay
- **States**: phase chrome; line tones; focus on input
- **Accessibility**: keyboard-first; `aria-live` for output; Esc exits to brand when nested
- **Motion**: mode crossfade only; canvas remains decorative

### ModeShell (HomeExperience)
- **Variants**: `brand` | `interface`
- **Keyboard**: `i` enters interface from brand (when not typing); Esc returns from interface
- **Motion**: emphasis crossfade 400–500ms; reduced-motion instant swap

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | CTA press, work row |
| Standard | 240ms | ease-in-out | Focus rings, border accents |
| Emphasis | 480ms | cubic-bezier(0.16, 1, 0.3, 1) | Brand ↔ interface mode |
| Atmosphere | 12s loop | linear | Hero field drift (decorative) |

### Rules
- Animate only `transform` and `opacity` (borders/colors for micro UI states allowed).
- Respect `prefers-reduced-motion`.
- Budget: atmosphere idle, work-row hover, mode transition — nothing else decorative.

## 7. Depth & Surface

### Strategy
**borders-only** with subtle tonal shifts. No multi-layer shadows, no glow stacks.

| Type | Value | Usage |
|------|-------|-------|
| Default | 1px solid var(--border-default) | Work rules, terminal edge |
| Subtle | 1px solid var(--border-subtle) | Soft separations |
| Accent edge | 1px solid var(--accent-primary) | Active terminal / focus |

Terminal panel uses a single left accent rule + tonal fill. No drop-shadow haze.
