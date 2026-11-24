# Deployment

NightCamFinds is deployed as a Node.js web service on Render.

## Production entrypoint

The production start command is:

```bash
npm start
```

`package.json` runs the production migrations and required patch scripts before starting `route.js`.

## Required production configuration

Render supplies the runtime configuration through environment variables defined in `render.yaml`, including:

- `DATABASE_URL`
- `DATABASE_SSL`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CB_CAMPAIGN`
- `CB_TOUR`
- `CB_POSTBACK_SECRET`
- `BONGACAMS_CAMPAIGN`
- `BONGACASH_POSTBACK_SECRET`

Secrets must be configured in Render. They should never be committed to GitHub.

## Verification before release

Run:

```bash
npm ci
npm test
npm run verify
```

The GitHub Actions workflow runs these checks automatically.

## Production flow

1. Push the intended change to `main`.
2. GitHub Actions runs the tests and production verifier.
3. Render auto-deploys the new commit.
4. Verify the deployment and then smoke-test the public site and affiliate redirects.

Do not trigger a second Render deployment while an automatic deployment for the same commit is already running.
