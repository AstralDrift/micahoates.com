# Agent Notes

## Project Conventions

- Use the Next.js App Router under `src/app`.
- Keep editable site copy in `src/lib/site-content.ts`.
- Keep client-only behavior isolated to small components.
- Prefer semantic HTML and stable responsive layout primitives.
- Use Tailwind utilities plus the shared tokens in `src/app/globals.css`.
- Keep dependencies minimal. Do not add a database, auth, analytics, trackers, or paid services.
- Keep the site static-export compatible for GitHub Pages.

## Before Commit

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

For visual changes, also run the app and verify desktop and mobile render without console errors or hydration errors.

## Accessibility And Performance

- Preserve keyboard access for the `?` command menu and terminal command form.
- Maintain visible focus states and accessible names on interactive controls.
- Respect `prefers-reduced-motion`.
- Keep terminal output as DOM text; canvas visuals must remain decorative.
- Avoid layout shift by using stable dimensions for the terminal panel and command palette.
- Keep animations progressive and non-essential.

## Content Integrity

- Do not fabricate credentials, employers, degrees, awards, metrics, clients, or project outcomes.
- Keep the interface keyboard-first and terminal-led.
- Do not add public repository links, outreach surfaces, analytics, auth, or backend behavior unless the site owner explicitly asks for them.
