# NightCamFinds Production Runbook

This repository deploys to Render from `main`. Keep secrets in Render Environment, never in this repository.

## Production services
- Website: https://nightcamfinds.com
- Render duplicate/alternate service: https://nightcamfinds-1.onrender.com
- GitHub: https://github.com/iiiijn/nightcamfinds

Both Render services were found connected to the same `main` branch during the 2026-10-22 production audit. Keep both on the same environment until you intentionally retire one.

## Required Render environment
- `DATABASE_URL`: must be the actual internal connection string for `nightcamfinds-db`, or a real Render Blueprint reference (`fromDatabase: { name: nightcamfinds-db, property: connectionString }`) applied through Blueprint sync. Do not type `${{...}}` into a normal service environment value field; Render variable interpolation is not supported there. The live services were audited on 2026-10-22 and currently need the database connection re-applied in Render before persistent tracking/dashboard reads work. Do not paste a database credential into chat or GitHub.
- `DATABASE_SSL`: `true` on Render.
- `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`: all required for dashboard login. Use long unique secrets.
- `PUBLIC_ORIGIN`: `https://nightcamfinds.com` on the primary custom-domain service. Do not set to a secondary Render host on the primary service.
- `CB_CAMPAIGN` and `CB_TOUR`: values from your own Chaturbate affiliate account.
- `BONGACAMS_CAMPAIGN`: your BongaCash/BongaCams campaign ID.
- `BONGACASH_POSTBACK_SECRET`: only set if the affiliate platform supports a postback and you configured the exact matching secret in the affiliate account. Otherwise leave unset; do not claim automatic conversion tracking.

## Tracking labels
Use URL parameters consistently:
- `utm_source=x`, `utm_medium=social`, `utm_campaign=nightcamfinds-female` or `nightcamscout-male`
- Telegram: `utm_source=telegram&utm_medium=social`
- Paid traffic: use the actual network as source and `utm_medium=paid`
- `src` is a placement ID (for example `cb-cam-listing`, `cb-banner`, `bc-dynamic`, `bc-geo`, `bc-sticky`).

## Release checklist
1. Check latest Render deploy is `live`.
2. Check homepage and `/dashboard` load on the intended primary domain.
3. Log into the dashboard and ensure the session remains authenticated after refresh.
4. Open one Chaturbate room card and one BongaCams room card from the website. Each should redirect to its own affiliate platform.
5. Verify `affiliate_clicks` increased in Postgres, with `platform`, `source`, `medium`, `campaign`, `placement`, `country`, `device` and `click_id` populated where available.
6. Confirm the postback route is only reported as active after a real test event appears in the matching conversion table.
7. Never infer revenue from a click. Use confirmed affiliate reports or postbacks.

## Known integration notes (audit 2026-10-22)
- The database exists and contains the affiliate analytics tables.
- Click rows exist in `affiliate_clicks`; sampled records have some missing source/medium values, so ensure links carry UTMs and click-redirect code preserves them.
- The `bonga_conversions` table currently contains zero records at the time of audit. BongaCash automatic conversion tracking is therefore not verified.
- Chaturbate conversions have a record, but test its event type and payout before treating it as revenue.
- If Render logs show a database host resolution error, inspect `DATABASE_URL` in Render. Never place a literal database URL in GitHub.
- The Render database is Free and expires on 2026-11-01 at 02:00 UTC. Upgrade or migrate before then to avoid losing persistence.

## Revenue definitions
- EPC = confirmed affiliate earnings / affiliate outbound clicks.
- Registration rate = confirmed registrations / affiliate outbound clicks.
- Conversion rate must be labeled according to what is actually being counted. Do not add registrations and purchases together as distinct people unless the affiliate platform confirms that interpretation.
- ROI is only meaningful when the ad spend for the same campaign/time range is entered.

## Reconnect the database (required after the 2026-10-22 audit)
1. Open the database: https://dashboard.render.com/d/dpg-davh085g1s2s73afq0kg-a
2. Open its **Connect** section and copy the **Internal Database URL**. Keep it private.
3. Open the primary service environment page: https://dashboard.render.com/web/srv-davnoopsrm7s73cnbj5g/env
4. Edit `DATABASE_URL`, paste the Internal Database URL directly in Render, and set `DATABASE_SSL` to `true` (the code uses SSL unless explicitly set to `false`). Save and deploy.
5. Repeat for the duplicate service if you intend to keep it: https://dashboard.render.com/web/srv-davo849srm7s73coquhg/env
6. Check the service logs for absence of `ENOTFOUND base`, then test `/dashboard` login. Do not send the database URL, password, or session secrets to anyone.

Alternative: if you manage the service through a Render Blueprint, sync the Blueprint after ensuring `render.yaml` has `fromDatabase: { name: nightcamfinds-db, property: connectionString }` on `DATABASE_URL`. Don't create a second Blueprint over already-managed resources; Render warns against managing a resource with multiple Blueprints.

## Troubleshooting
- Login stays on the login screen: open DevTools or browser Network panel and inspect `POST /api/auth/login`; never share passwords or cookie tokens.
- Empty dashboard: verify login, `DATABASE_URL`, SQL schema, then click data and postback data separately.
- Incorrect platform total: verify each link hits the correct route (`/go/` for Chaturbate, `/bgo/` for BongaCams) and the matching affiliate destination.
