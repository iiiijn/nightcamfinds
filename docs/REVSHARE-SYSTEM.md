# RevShare-first affiliate system

## Business objective
Prioritize Chaturbate RevShare revenue from referred users' spending. The account screenshot supplied by the owner shows a program labelled `Revshare: 20% of Money Spent + $50 per broadcaster + 5% Referred Affiliate Income`. NightCamFinds reports partner-sent amounts; it cannot change the rate offered by Chaturbate.

## Flow
1. The room directory serves cached Chaturbate and BongaCams listings.
2. Every outbound `/go/` or `/bgo/` redirect records a unique click ID and traffic context.
3. Chaturbate Dynamic Postbacks send event fields to `/cb/postback`.
4. Each transaction is stored once using `(platform, transaction_id)` idempotency.
5. RevShare purchase events and payout adjustments are tracked as the primary KPI; broadcaster referral and referred-affiliate income remain separate.
6. `/api/revenue` reports totals, EPC and country/source breakdowns. It requires a private dashboard key in the `X-NCF-Stats-Key` header.

## Required production configuration
- Persistent PostgreSQL `DATABASE_URL`.
- `NODE_ENV=production`.
- Strong random `STATS_KEY`.
- `CB_POSTBACK_SECRET` only if Chaturbate's postback configuration can append the corresponding `secret` parameter. Otherwise enable only a verified partner-supported access-control mechanism; do not rely on an unprotected public endpoint.
- `PUBLIC_ORIGIN` for the deployed domain.
- The correct campaign `C6yxN` and current tour `LQps`.

## Release gates
- Passing automated tests.
- `GET /health` and `/api/rooms` checked on staging.
- Postback event saved and confirmed visible in Chaturbate's postback log.
- Duplicate transaction replay does not increase revenue.
- Revenue totals reconciled against Chaturbate Stats / transaction CSV.
- Check that current production room links and dashboard continue to work after the staging change.

## Important limitations
- An affiliate postback is not the same as a verified cash payout. Treat partner-reported commission as provisional until reconciled with partner stats/payment statements.
- Chaturbate postback may be unable to use a shared secret unless the partner UI supports it. Verify on staging before production.
- This system does not change affiliate terms, generate real referrals by itself, or guarantee revenue.