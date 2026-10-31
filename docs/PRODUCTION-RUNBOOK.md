# NightCamFinds Production Runbook

This repository deploys to Render from `main`. Keep secrets in Render Environment, never in this repository.

## Production services
- Website: https://nightcamfinds.com
- GitHub: https://github.com/iiiijn/nightcamfinds

Render workspace inspection on 2026-10-31 found one active web service: `nightcamfinds`, connected to `main`. Recheck the Render workspace before adding or retiring services.

## Required Render environment
- `DATABASE_URL`: production connectivity to `nightcamfinds-db` was verified from live application logs and read-only database checks on 2026-10-31. Do not expose or paste the credential into chat or GitHub. Recheck the Render environment only if database connectivity fails.
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
- Render PostgreSQL `nightcamfinds-db` is on the paid `0.1c-256mb` plan ($6/month compute) as of 2026-10-31. A logical export was created in Render Recovery on 2026-10-31 at 23:53 Kenya time and downloaded by the owner. Restore has not been tested. Render says export files are retained for at least 7 days; keep the downloaded copy securely offsite.

## Revenue definitions
- EPC = confirmed affiliate earnings / affiliate outbound clicks.
- Registration rate = confirmed registrations / affiliate outbound clicks.
- Conversion rate must be labeled according to what is actually being counted. Do not add registrations and purchases together as distinct people unless the affiliate platform confirms that interpretation.
- ROI is only meaningful when the ad spend for the same campaign/time range is entered.

## Troubleshooting
- Login stays on the login screen: open DevTools or browser Network panel and inspect `POST /api/auth/login`; never share passwords or cookie tokens.
- Empty dashboard: verify login, `DATABASE_URL`, SQL schema, then click data and postback data separately.
- Incorrect platform total: verify each link hits the correct route (`/go/` for Chaturbate, `/bgo/` for BongaCams) and the matching affiliate destination.
