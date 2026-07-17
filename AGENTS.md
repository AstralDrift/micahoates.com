# Agent Notes

## Project Conventions

- Use the Next.js App Router under `src/app`.
- Keep editable site copy in `src/lib/site-content.ts` (brand pitch, selected work, SEO).
- Keep quiet-interface puzzle/copy in `src/lib/quiet-interface/`.
- Keep client-only behavior isolated to small components.
- Prefer semantic HTML and stable responsive layout primitives.
- Use shared tokens from `DESIGN.md` / `src/app/globals.css`.
- Keep dependencies minimal. Do not add a database, auth, analytics, trackers, or paid services.
- Keep the site static-export compatible for GitHub Pages.

## Product Surface

- Default mode is the **brand surface** (name, pitch, selected work). Pointer input is allowed there.
- Secondary mode is the **quiet interface** (keyboard-first terminal puzzle). Enter via CTA or `i`; leave via Esc or `exit`.
- Selected work rows are allowed. Do not add resume spam, social feeds, or visible contact forms.
- Do not expose a primary mailbox. Hidden contact output should use a domain-scoped alias.
- Do not add analytics, auth, or backend behavior unless the site owner explicitly asks.

## Before Commit

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm run smoketest
```

For visual changes, also run the app and verify desktop and mobile render without console errors or hydration errors.

## Accessibility And Performance

- Preserve keyboard access for the `?` command menu and terminal command form.
- Maintain visible focus states and accessible names on interactive controls.
- Preserve the no-JavaScript fallback state.
- Respect `prefers-reduced-motion`.
- Keep terminal output as DOM text; canvas visuals must remain decorative.
- Avoid layout shift by using stable dimensions for the terminal panel and command palette.
- Keep animations progressive and non-essential.

## Content Integrity

- Do not fabricate credentials, employers, degrees, awards, metrics, clients, or project outcomes.
- Brand surface should stay scannable; interface mode stays keyboard-first.
