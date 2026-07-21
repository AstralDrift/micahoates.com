# Quiet Interface Design System

## 1. Atmosphere & Identity

The interface feels like a precise instrument discovered in a dark room: quiet at rest, legible under pressure, and more revealing as the operator forms a correct mental model. Its signature is the signal relay, one state expressed twice through a textual shell and a procedural apparatus. Neither surface decorates the other; commands, files, paths, and visual geometry must agree.

## 2. Color

### Palette

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Surface/void | `--color-void` | `#020403` | Page and canvas base |
| Surface/terminal | `--color-terminal` | `#030806` | Opaque terminal operating surface |
| Surface/terminal-soft | `--color-terminal-soft` | `#030707` | Released and reduced surfaces |
| Text/primary | `--color-text` | `#e8f0ea` | Commands and primary output |
| Text/secondary | `--color-soft` | `#a3b0a6` | Standard command output |
| Text/muted | `--color-muted` | `#728078` | Labels, hints, dormant content |
| Rule/subtle | `--color-rule` | `rgba(190, 220, 204, 0.12)` | Dividers and registration marks |
| Rule/active | `--color-rule-active` | `rgba(118, 239, 182, 0.32)` | Focused terminal edge and active geometry |
| Signal/green | `--color-signal` | `#76efb6` | Valid actions, prompt, active state |
| Signal/cyan | `--color-carrier` | `#67dff3` | Carrier paths, outside state, secondary signal |
| Status/warning | `--color-warning` | `#e1c97e` | Recoverable, gated input |
| Status/error | `--color-error` | `#dc8d88` | Invalid command or signal |
| Outside/white | `--color-outside` | `#eefcff` | Released identity and final line |

### Rules

- The page stays near-black; color appears only as state evidence.
- Green means a valid local operation. Cyan means carrier, connection, or outside state.
- Warning and error colors are brief and never used as ambient decoration.
- Puzzle information is never encoded by color alone.
- New colors must be added here before use.

## 3. Typography

### Scale

| Level | Size | Weight | Line height | Tracking | Usage |
| --- | --- | --- | --- | --- | --- |
| Terminal/primary | `0.9375rem` | 400 | 1.64 | 0 | Commands and output |
| Terminal/compact | `0.8125rem` | 400 | 1.56 | 0 | Mobile output |
| Label | `0.75rem` | 500 | 1.4 | 0 | Chrome, hints, key labels |
| Final | `1.0625rem` | 500 | 1.56 | 0 | Release statement |

### Font stack

- Mono: `Berkeley Mono`, `IBM Plex Mono`, `SFMono-Regular`, `SF Mono`, `JetBrains Mono`, `Fira Code`, `Consolas`, `Liberation Mono`, `Menlo`, `monospace`.
- No external font request is allowed. The site must render well using the system fallbacks.

### Rules

- The interface uses one monospace family to preserve the operating-surface metaphor.
- Letter spacing is always `0`.
- Mobile text remains at least 13px; the editable input remains 16px to prevent browser zoom.
- Output wraps as text. Command tables adapt into stacked rows rather than relying on fixed columns.

## 4. Spacing & Layout

### Base unit

All layout spacing derives from 4px.

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | `0.25rem` | Tight inline separation |
| `--space-2` | `0.5rem` | Compact rows |
| `--space-3` | `0.75rem` | Prompt and output rhythm |
| `--space-4` | `1rem` | Standard terminal inset |
| `--space-5` | `1.25rem` | Comfortable separation |
| `--space-6` | `1.5rem` | Desktop terminal inset |
| `--space-8` | `2rem` | Major local separation |
| `--space-12` | `3rem` | Page framing |
| `--space-16` | `4rem` | Wide desktop framing |

### Grid

- Desktop uses a constrained two-zone composition: a 36-42rem terminal left of center and a flexible apparatus field to the right.
- Tablet lets the apparatus overlap the terminal's negative space but never its readable text.
- Mobile uses one full-height terminal surface; the apparatus recedes behind the outer frame instead of competing with text.
- The terminal fill remains opaque so the animated canvas cannot destabilize glyph compositing.
- The terminal owns a compositor layer so canvas updates cannot drop or smear text glyphs.
- The minimum page height uses dynamic viewport units and safe-area insets.
- The command form remains visible when the visual viewport is reduced by a software keyboard.

### Rules

- Empty space is structural. It is not filled with labels, metrics, or panels.
- Terminal copy targets a readable width near 68 monospace characters.
- Fixed-format elements use stable tracks so state changes do not shift the layout.

## 5. Components

### Quiet terminal

- **Structure**: semantic `section`, compact state rail, scrollable DOM transcript, live announcement region, command form.
- **Variants**: dormant, active, inside, outside, system message.
- **Spacing**: `--space-3`, `--space-4`, `--space-6`, and `--space-8`.
- **States**: focused, composing, valid submission, gated command, error, released.
- **Accessibility**: labelled input, visible focus, independent polite announcements, focus restoration after overlays.
- **Motion**: new transcript groups enter through opacity and a short vertical transform.

### Signal apparatus

- **Structure**: decorative DPR-aware Canvas 2D field with a stable five-node relay and central aperture.
- **Variants**: dormant, observation, assembly, boundary, inside, outside.
- **States**: idle, typing, submit, inspect, valid, invalid, transition, release.
- **Accessibility**: `aria-hidden`; every clue and state also appears in DOM text.
- **Motion**: deterministic seeded movement, visibility suspension, reduced-motion static compositions.

### Directive index

- **Structure**: small modal directive list with command, description, and shortcut.
- **States**: open, selected, focused, empty.
- **Accessibility**: arrow navigation, unique-letter selection, Enter to run, Escape to close, focus restored to the terminal.
- **Motion**: opacity and small transform only.

### Mobile key strip

- **Structure**: five compact terminal keys for Tab, history up/down, palette, and Enter.
- **States**: default, pressed, focused.
- **Accessibility**: native buttons with explicit labels and 40px minimum touch targets.
- **Motion**: pressed opacity and transform only.

## 6. Motion & Interaction

### Timing

| Type | Token | Duration | Easing | Usage |
| --- | --- | --- | --- | --- |
| Micro | `--motion-micro` | `120ms` | `ease-out` | Key press, focus response |
| Standard | `--motion-standard` | `220ms` | `ease-out` | Transcript and palette entry |
| Emphasis | `--motion-emphasis` | `560ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Boundary and release transitions |

### Rules

- DOM motion uses only opacity and transform.
- Typing creates low-amplitude packets; submission creates one decisive pulse.
- Repeated commands retrigger their visual response.
- Invalid input shears briefly, settles quickly, and never flashes the full screen.
- Reduced motion renders every phase as a distinct stable composition at a low refresh rate.
- The canvas pauses while the document is hidden.

## 7. Depth & Surface

### Strategy: borders only

The terminal is defined by tonal fill, one active edge, sparse registration corners, and hairline rules. It has no card shadow and no floating-panel treatment. The apparatus creates depth through density, occlusion, and luminance rather than CSS elevation.

| Type | Value | Usage |
| --- | --- | --- |
| Subtle rule | `1px solid var(--color-rule)` | Transcript divider, palette rows |
| Active rule | `1px solid var(--color-rule-active)` | Focused edge, selected directive |
