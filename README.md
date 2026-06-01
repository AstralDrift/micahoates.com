# Quiet Interface

A static, keyboard-first web artifact built as a quiet operating surface rather than a conventional homepage.

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

GitHub Pages is the documented hosting target. The generated static artifact includes `public/CNAME` for the configured custom domain.

## Artifact Metadata

The static export includes:

- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- `site.webmanifest`
- SVG favicon and Apple touch icon
- canonical, Open Graph, Twitter, and JSON-LD metadata

## Notes

- No backend, database, auth, analytics, or paid API is required.
- The primary interaction is deterministic and local.
- Keep the public surface sparse; do not add resume sections, project cards, social feeds, or visible contact forms without an explicit product decision.
