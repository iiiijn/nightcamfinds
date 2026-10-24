# NightCamFinds V2 deployment and verification

## Primary goal
The primary commercial KPI is Chaturbate RevShare revenue (20% of referred-user spending per the owner-provided affiliate dashboard). Broadcaster-referral payments and referred-affiliate income must remain separately reported.

## Deploying a test build
1. Keep `main` serving production until the staging checks below pass.
2. Create a staging Render service from branch `system-v2-foundation` (or use a separate staging service for the same repository). Do not change the existing production service yet.
3. Set the start command to `npm start` (the V2 package start script points to `node boot-v2.js`; confirm that bootstrap file exists and starts the intended V2 server before deployment).
4. Configure `PUBLIC_ORIGIN` to the staging URL, `CB_CAMPAIGN=C6yxN`, `CB_TOUR=LQps`, `BONGACAMS_CAMPAIGN=840970`, and an actual persistent PostgreSQL `DATABASE_URL`.
5. Set a long random `STATS_KEY`. Never use the example secrets in `.env.example` in a deployed environment.
6. Set Chaturbate Dynamic Postback to the staging `/cb/postback` URL, using the configured fields: `click_id`, `transaction_id`, `type`, `payout`, `currency`, `amount`, `country`, `track`, `source`, `program_id`, `user_id`, `timestamp`.
7. Before production, gate postback intake using a partner-supported secret, signature, or verified access-control method. Do not rely only on a publicly callable URL.

## Acceptance tests
- `GET /health` returns 200 and identifies V2.
- `GET /api/rooms` returns JSON and does not expose server credentials.
- A room click redirects to the correct provider and creates one unique click record.
- A test postback with a unique transaction ID is stored.
- Re-sending the same transaction is marked duplicate and does not increase revenue.
- RevShare purchases are counted separately from broadcaster and affiliate referral income.
- Unknown click IDs remain unmatched and are never assigned to an invented source.
- `GET /api/revenue` returns summary and country/source breakdowns only with a valid stats key.
- The dashboard loads on HTTPS and displays an empty state when there are no events.
- Review hosting logs, PostgreSQL persistence, and Chaturbate's own postback log. A 200 response from NightCamFinds alone does not prove the partner accepted the URL.
- Smoke-test frontend assets, thumbnails, and outbound links.

## Critical cautions
- Do not deploy an unauthenticated postback receiver to production. Confirm the partner-supported verification pattern before enabling production intake.
- Postbacks report what the partner sends; they do not change or guarantee the affiliate program terms.
- Reconcile revenue against Chaturbate Stats/CSV export before scaling traffic.
- Use PostgreSQL as the persistent production source of truth.
- Never commit live account credentials, database URLs, or production secrets.

## Revenue metric definitions
- RevShare revenue: sum of partner-reported payouts for events classified as RevShare.
- RevShare EPC: RevShare revenue divided by tracked clicks for the same date range and platform filter. This is a directional metric, not a guaranteed forecast.
- Matched event: a postback click ID corresponds to a recorded NightCamFinds click.
- Unmatched event: a revenue event has no matching click record.
- Deduplicate by transaction ID. Reconcile adjustments and reversals with the partner export.