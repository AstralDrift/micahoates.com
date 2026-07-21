# Quiet Interface

A deterministic, keyboard-first system surface. The complete experience runs locally in the browser and exports as static files.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run smoketest
```

`npm run build` writes the static export to `out/`.

## Deployment

GitHub Actions deploys `main` through `.github/workflows/pages.yml`. The generated artifact includes `public/CNAME` for the configured custom domain.

## Constraints

- No backend, database, authentication, analytics, external runtime API, or paid service.
- All meaningful output is DOM text; the procedural canvas is decorative.
- Puzzle state is deterministic and stored locally on a best-effort basis.
- Contact remains inside the interface and is intentionally absent from this document.
