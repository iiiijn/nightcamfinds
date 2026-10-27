# NightCamFinds

NightCamFinds is an independent live-cam discovery and affiliate directory. The production service is a Node.js application that serves the site from `public/`, fetches partner room data, creates tracked outbound links, and records affiliate attribution in PostgreSQL.

## Current production architecture

- Render service: `nightcamfinds`
- Runtime: Node.js 20+
- Production entrypoint: `route.js`
- Startup command: `npm start`
- Static/public assets: `public/`
- Database: PostgreSQL via `DATABASE_URL`
- Partner integrations: Chaturbate and BongaCams/BongaCash
- Production verification: `npm run verify`
- Automated tests: `npm test`

The startup command applies the required database migrations and production patches before starting `route.js`. The SPA SEO patch is intentionally applied exactly once at startup.

## Verification

Run locally:

```bash
npm ci
npm test
npm run verify
```

The GitHub Actions production verification workflow runs the same checks on pushes and pull requests.

## Render configuration

`render.yaml` is the source of truth for the service configuration. Required runtime secrets and partner campaign/postback values are supplied through Render environment variables.

## Project structure

- `route.js` - production HTTP server, room feeds, redirects, tracking and dashboard APIs
- `bongacash.js` - BongaCash attribution and reporting support
- `public/` - production browser assets and public pages
- `scripts/` - startup patches, migrations and verification
- `src/` - reusable service, adapter, database, security and MFA modules used by the test/readiness layer and retained for the application architecture
- `sql/` - database migrations
- `tests/` - automated tests
- `docs/` - operational documentation
- `vendor/` - vendored MFA/QR dependencies required by `src/mfa.js`

## Deployment

Push to `main` and Render auto-deploys the updated service. Do not manually trigger a second deployment when an auto-deploy is already running.

The public site does not host video. Room cards link visitors to the partner platform where the room is hosted.
