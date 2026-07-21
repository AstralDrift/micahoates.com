# Agent Notes

## Project Conventions

- Use the Next.js App Router under `src/app`.
- Keep public metadata in `src/lib/site-content.ts`.
- Keep interface copy, filesystem behavior, and puzzle state in `src/lib/quiet-interface/`.
- Keep client-only behavior isolated to interactive leaf components.
- Use shared tokens from `DESIGN.md` and `src/app/globals.css`.
- Keep dependencies minimal and the build compatible with GitHub Pages static export.

## Product Surface

- The root route is the Quiet Interface. Do not add a brand hero, navigation, work list, case study, biography, resume, social links, or visible contact form.
- The experience is keyboard-first and uses a deterministic Linux-like filesystem puzzle.
- Identity and contact remain behind the release path.
- Do not expose project names, clients, employers, credentials, or a primary mailbox in public UI or metadata.
- Do not add analytics, auth, backend behavior, external runtime services, AI calls, or paid APIs.

## Before Commit

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm run smoketest
```

For visual changes, verify desktop, tablet, mobile, short-height desktop, reduced motion, and no-JavaScript states without console or hydration errors.

## Accessibility And Performance

- Preserve keyboard access for the `?` command palette and terminal form.
- Maintain visible focus, accessible names, and screen-reader status announcements.
- Keep terminal output as DOM text; canvas visuals remain decorative and `aria-hidden`.
- Preserve the no-JavaScript fallback and forced-colors behavior.
- Respect `prefers-reduced-motion` without removing meaningful state feedback.
- Keep the active mobile input visible above the software keyboard.
- Avoid layout shift and suspend canvas work while the page is hidden.

## Content Integrity

- Do not fabricate or advertise work, outcomes, credentials, employers, clients, or expertise.
- Do not publish the puzzle solution or release/contact path in repository-facing documentation.
