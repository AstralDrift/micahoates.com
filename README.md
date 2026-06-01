# micahoates.com

Keyboard-first personal site for Micah Oates, built as a quiet interactive system interface rather than a conventional portfolio page.

The site is a static Next.js export hosted on GitHub Pages at:

- https://micahoates.com

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

`npm run build` creates the static export in `out/`.

## Deployment

GitHub Actions deploys `main` through `.github/workflows/pages.yml`.

The production domain is configured through GitHub Pages and Namecheap DNS:

- Apex A records point to GitHub Pages.
- `www` points to `AstralDrift.github.io`.
- `public/CNAME` preserves the custom domain in the static artifact.

## Search And Agent Metadata

The static export includes:

- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- `site.webmanifest`
- SVG favicon and Apple touch icon
- canonical, Open Graph, Twitter, and JSON-LD metadata

Contact details are intentionally not exposed in metadata or static agent files. They are revealed inside the interface after the release path.

## Notes

- No backend, database, auth, analytics, or paid API is required.
- The primary interaction is deterministic and local.
- Keep the public surface sparse; do not add resume sections, project cards, social feeds, or visible contact forms without an explicit product decision.
