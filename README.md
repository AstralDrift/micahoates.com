# micahoates.com

Production-ready personal website for Micah Oates, built with Next.js App Router, TypeScript, Tailwind CSS, and a small amount of Framer Motion.

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
npm run start
```

`npm run start` runs the built Next.js app and respects Railway's `PORT`.

## Railway Deployment

This repo includes `railway.json` with:

- `buildCommand`: `npm ci && npm run build`
- `startCommand`: `npm run start`
- `healthcheckPath`: `/`
- restart policy: `ON_FAILURE`, max retries `10`

Deploy by connecting this repository in Railway. No environment variables are required.

## Custom Domain

After the Railway service is deployed:

1. Add `micahoates.com` as a custom domain in Railway.
2. Add the DNS records Railway provides at your DNS provider.
3. Wait for Railway to issue TLS.
4. Confirm `https://micahoates.com`, `/robots.txt`, and `/sitemap.xml` load correctly.

## Editing Site Content

Most visible content lives in `src/lib/site-content.ts`:

- hero copy
- command definitions
- systems map nodes
- terminal output content
- automation and AI workflow labels

## Notes

- Do not add analytics, trackers, auth, database dependencies, or paid services without a deliberate reason.
- Do not add public repository links or outreach surfaces without an explicit product decision.
