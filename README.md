# NightCamFinds

Independent live-cam discovery platform. BongaCash and Chaturbate are providers. NightCamFinds owns discovery, routing, and tracking.

## Run

```bash
cp .env.example .env
npm test
npm start
```

Open http://localhost:8787

Development uses embedded PostgreSQL (PGlite) and the SQL migrations. Production requires `DATABASE_PROVIDER=postgres` and `DATABASE_URL`. It will not start on the development fallback, the default admin password, or with BongaCash postbacks enabled.

Owner MFA is TOTP. Production must set `OWNER_MFA_SECRET`. If it is unset, MFA is `REQUIRES_VERIFICATION` and launch is blocked.

## What is implemented

- Public directory, categories, country selector, search, Surprise Me
- Chaturbate adapter against documented API v2 (`/api/public/affiliates/onlinerooms/`)
- BongaCash adapter that refuses to invent rooms or destinations
- Affiliate router with domain allowlist and random click IDs
- Chaturbate postback intake with duplicate and unmatched handling
- Admin kill switches: providers, redirects, postbacks, maintenance
- PostgreSQL schema in `sql/001_init.sql` (runtime store is a JSON file mirror for this environment)
- 18+ notice, legal pages, robots, sitemap

Set `SITE_URL` and `CONTACT_EMAIL` in the environment before launch. Legal pages use those values. The public admin link is no longer in the footer; `/admin` still exists.

## What is not production-complete

See `docs/verification-registry.md`. MFA, WAF, CDN, real PostgreSQL backups, and BongaCash API/postbacks are not claimed as done.

Do not treat this build as a legal compliance determination.
