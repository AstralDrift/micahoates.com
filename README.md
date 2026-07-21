# micahoates.com

A static personal site: brand-first systems surface with a deeper keyboard interface.

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
npm run smoketest
```

`npm run build` creates the static export in `out/`.

`npm run smoketest` runs the browser-level brand + interface smoke suite.

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
- Default view is the brand surface (name, pitch, selected work).
- The quiet interface is a secondary mode (CTA or `i`); Esc / `exit` returns to brand.
- Contact is revealed only through the in-interface path and should use a domain-scoped alias, not a primary mailbox.
- Design tokens live in `DESIGN.md`. Do not reintroduce CRT neon-green identity.
