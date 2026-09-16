# Quiet Interface Design System

## 1. Atmosphere And Identity

The site is one discovered operating surface. It should feel precise, quiet, and slightly uncanny: a machine already running before the visitor arrived. There is no public portfolio layer, marketing hero, work index, navigation, or explanatory biography.

The terminal and procedural apparatus are one instrument. The apparatus begins as a dormant seed and becomes a sequence of distinct machines as the visitor observes, decodes, assembles, verifies, mounts, enters, and releases the boundary. Terminal input travels into the active structure. Each milestone changes its geometry rather than only changing brightness. Identity and contact remain behind the release path.

The visual hierarchy is intentional:

1. The active shell prompt is the control point.
2. The transcript is evidence.
3. The current machine is the physical consequence of that evidence.
4. Everything else is residual field noise and must stay subordinate.

## 2. Color

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Surface | `--surface-primary` | `#020705` | Page and canvas ground |
| Surface secondary | `--surface-secondary` | `#07100C` | Subtle terminal depth |
| Text primary | `--text-primary` | `#E6EEE9` | Commands and final output |
| Text secondary | `--text-secondary` | `#B3BDB7` | Normal transcript |
| Text tertiary | `--text-tertiary` | `#7B877F` | Chrome and hints |
| Signal | `--accent-primary` | `#76EFB6` | Active input and valid state |
| Instrument | `--accent-steel` | `#8EB9C4` | Secondary apparatus geometry |
| Warning | `--status-warning` | `#D1AD6C` | Recoverable puzzle friction |
| Error | `--status-error` | `#CF8585` | Invalid shell input |

Rules:

- Black is the dominant field; green, cyan, and white carry hierarchy.
- Color never carries a required clue by itself.
- No purple, neon bloom, multi-color gradients, or generic hacker green rain.
- Surfaces use transparency and hairlines, not card shadows.

## 3. Typography

The interface uses a local system monospace stack only. There are no external font requests.

| Level | Size | Line height | Usage |
| --- | --- | --- | --- |
| Transcript | `0.9375rem` | `1.64` | Desktop terminal output |
| Mobile transcript | `0.8125rem` | `1.56` | Narrow viewport output |
| Final line | `1.05rem` | inherited | Release payoff |
| Chrome | `0.72rem` | inherited | Phase and service state |
| Hint | `0.76rem` | inherited | Delayed contextual hint |

Letter spacing is zero. Text remains real DOM content, selectable, zoomable, and screen-reader accessible.

## 4. Spacing And Layout

Spacing uses a 4px base with `--space-1` through `--space-12`.

- Desktop: terminal occupies the left focal column; the machine owns the negative space to its right and connects to the input through one precise signal filament.
- Tablet: retain the two-part composition while there is enough room to keep both elements legible.
- Mobile: terminal fills the safe viewport over a reduced Canvas 2D scene. The scene uses fewer nodes, a device-pixel-ratio cap of 1.25, no canvas text, and a 24 fps idle limit.
- Terminal dimensions remain stable while output, hints, and command status change.
- The command form stays visible above the software keyboard.
- No horizontal overflow at supported viewport sizes.

## 5. Components

### QuietInterfaceExperience

Owns the discriminated puzzle progression, transcript dispatch, versioned partial-session persistence, hints, command palette state, milestone blocking, and the terminal-to-canvas signal contract.

### QuietTerminal

Real DOM transcript plus a persistent command input. Supports Enter, Tab completion, command history, `?`, Escape-to-clear, `Ctrl+L`, and a compact mobile key strip.

### QuietInterfaceCanvas

DPR-capped decorative Canvas 2D machine. It reacts to typing and command events, suspends while hidden, and respects reduced motion. The scenes are a dormant seed, socket receiver, traced topology, signal rail, image frames, full-height gate, tunnel, release wave, and cold horizon. It contains no exclusive text or clues.

### CommandPalette

An inline directive index for discovered commands. Arrow keys select, Enter runs, Escape closes, and unique first letters run immediately.

### QuietSystemMessage

Terminal-native error, not-found, and no-JavaScript surfaces. It never becomes a conventional page.

## 6. Motion And Interaction

| Type | Duration | Usage |
| --- | --- | --- |
| Micro | `180ms` | Transcript entry, error shear, palette entry |
| Idle | `24 fps` | Cached field plus low-amplitude scene motion |
| Active | up to `60 fps` | Typing packets and active event envelopes |
| Boot | `700ms` | Seed-to-receiver transition |
| Signal lock | `500ms` | Topology-to-rail transition |
| Image build | `1100ms` | Boundary frame assembly |
| Verification | `800ms` | Checksum frame confirmation |
| Mount | `1400ms` | Full-height gate expansion |
| Entry | `900ms` | Gate-to-tunnel transition |
| Release | `1800ms` | Viewport wave and horizon transition |

Rules:

- Motion is deterministic enough for stable tests.
- Canvas work pauses while the page is hidden and caps device pixel ratio at 2 on desktop and 1.25 on mobile.
- Reduced motion settles event envelopes immediately and retains the final state geometry.
- The terminal is busy during milestone envelopes. Escape settles the active envelope immediately.
- No flashing, full-screen glitching, layout animation, or game-like meters.

## 7. Depth And Surface

Depth is borders-only with subtle tonal transparency.

- Terminal: one active left rule and two quiet corner marks.
- Palette: one active left rule, no shadow.
- Outside state: terminal chrome and framing recede, the instrument resolves to a single horizon, and the final DOM line carries the conclusion.
- The canvas supplies spatial depth; DOM surfaces do not imitate dashboard panels.
