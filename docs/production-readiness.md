# Production readiness

Status of public launch: BLOCKED pending the remaining verification gates below.

Production audit update (2026-10-31): the Render web service `nightcamfinds` is live on the Starter compute plan, and the Render PostgreSQL instance `nightcamfinds-db` is available on the paid `0.1c-256mb` plan in Frankfurt. The live service logs report the affiliate attribution schema ready, and direct read-only database checks confirmed existing click and conversion tables. This verifies hosted PostgreSQL provisioning and application connectivity. It does not verify backup/restore, every affiliate postback, or a full production smoke test.

## 1. Production PostgreSQL

The app expects a standard PostgreSQL server reachable with a `postgres://` or `postgresql://` URL consumed by the `pg` driver. No vendor is hard-coded. PostgreSQL 14 or newer is the practical target because the schema uses `JSONB` and `TIMESTAMPTZ`. Managed examples that fit this interface include RDS, Cloud SQL, Azure Database, Neon, Supabase, or Crunchy. Pick one. Do not put the password in source.

Production configuration:

- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL` set only in the host secret store

PGlite is used only when `NODE_ENV` is not `production` and `DATABASE_PROVIDER=pglite`. Production startup exits if the provider is not `postgres`. The JSON store is not a database provider and throws if selected.

Migrations run automatically on process start from `sql/*.sql` through `src/db/connect.js`. They are additive (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and recorded in `schema_migrations`.

Manual equivalent, against a database you have already created. Do not drop tables.

```bash
psql "$DATABASE_URL" -f sql/001_init.sql
psql "$DATABASE_URL" -f sql/002_auth_and_config.sql
```

Then start the app once so `schema_migrations` is recorded. Do not run destructive SQL.

This environment did not connect to a hosted database. Hosted PostgreSQL is provisioned and reachable by the live application as of 2026-10-31. The database plan is `0.1c-256mb` ($6/month compute, as displayed in Render).

## 2. Production secrets

Required secrets, set in the host secret manager, never in git:

- `DATABASE_URL`
- `ADMIN_PASSWORD` (not `change-me`, at least 12 characters)
- `SESSION_SECRET` (at least 24 characters, not the example value)
- `OWNER_MFA_SECRET` (40 hex characters; see MFA)
- `POSTBACK_TOKEN` before accepting live Chaturbate postbacks

Required non-secret configuration:

- `NODE_ENV=production`
- `DATABASE_PROVIDER=postgres`
- `APP_BASE_URL` (public https origin)
- `ADMIN_USER`
- `CHATURBATE_WM=C6yxN`
- `CHATURBATE_ENABLED=true` only if that campaign is the one you intend to use
- `BONGACASH_ENABLED=false`
- `BONGACASH_POSTBACKS=false`
- `BONGACASH_CAMPAIGN=840970`
- `BONGACASH_PROGRAM=RevShare`

Optional:

- `PORT`
- `REDIS_URL` (unused at launch)
- `EMAIL_PROVIDER`, `EMAIL_FROM` (disabled)
- `BONGACASH_API_BASE` (leave empty until verified)

No production secret values are generated or shown here.

## 3. Owner MFA

Production startup exits unless `OWNER_MFA_SECRET` is a Base32 secret of at least 16 characters. Hex secrets are no longer accepted. The secret is read from the environment only and is not written to the database, Git, or docs.

Verification uses vendored `otpauth` 9.5.2: HMAC-SHA1, 6 digits, 30-second period, window of one step. The same step cannot be reused. Five failed MFA attempts in 15 minutes are rejected. Recovery codes are random, stored only as SHA-256 hashes, and rejected after one successful use. The enrollment QR is an SVG of the `otpauth://` URI. A phone authenticator scan has not been run, so app compatibility stays REQUIRES VERIFICATION.

Enrollment requires an owner session and the current password. The QR and recovery codes are returned once. A later request does not return them unless replace is requested with the current password.

Authenticator-app compatibility is not claimed until you scan the QR with your own app. The unit test only checks that the provisioning URI is `otpauth://totp/...` and that a code from the same library validates.

## 4. Chaturbate verification checklist

Do not assume the selected program.

- Confirm campaign `C6yxN` is the campaign in your affiliate account.
- Record the selected payout program from the account. Do not copy a guessed rate.
- Open a room from NightCamFinds `/go/{id}` and confirm the landing URL is on `chaturbate.com` and carries `click_id`.
- Confirm in Chaturbate docs/account that `click_id` is an accepted pass-through for your program.
- The production handler is `GET https://nightcamfinds.com/api/chaturbate/postback` (also accepts `/cb/postback`). The older `/postback/chaturbate` path in prior notes is not the active handler.
- For Dynamic Postbacks, use the documented Chaturbate macros: `{click_id}`, `{transaction_id}`, `{type}`, `{payout}`, `{currency}`, `{amount}`, `{country}`, `{track}`, `{source}`, `{campaign_id}`, `{program_id}`, `{user_id}`, `{timestamp}`, `{device}`, and `{language}`. Chaturbate documents GET and POST delivery; the current NightCamFinds handler is verified for GET only, so select GET.
- The handler requires real `click_id` and `transaction_id`, ignores literal macro-placeholder test probes, and stores conversion events idempotently by transaction ID. It checks the click against the legacy `cb_clicks` mirror; a live click ID was confirmed in both `cb_clicks` and `affiliate_clicks` on 2026-10-31.
- The optional Chaturbate validation-salt/checksum mechanism is not yet implemented in NightCamFinds. Do not configure checksum validation until its exact signature algorithm is implemented and tested. Do not set `CB_POSTBACK_SECRET` unless the postback request actually sends a matching `secret` parameter; Chaturbate's documented dynamic macro list does not include one.
- Configure the URL in the Chaturbate account only after verifying the selected campaign/program and the account's Dynamic Postbacks page. Send the URL tester first; it should receive `200 OK` without creating a conversion row. Real signup/purchase events remain REQUIRES VERIFICATION until one arrives with a real click ID and is matched.

## 5. BongaCash verification checklist

Keep `BONGACASH_ENABLED=false` and `BONGACASH_POSTBACKS=false`.

- Confirm campaign `840970` in the account.
- Copy the documented API base from the account or official docs. Do not invent it.
- Save a sample response and compare fields before any parser change.
- Confirm RevShare is the active program in the account.
- Record whether PPS is offered. Status stays REQUIRES VERIFICATION until the account says so.
- Copy the affiliate destination URL from the account. The app will keep redirects disabled until that URL is on an allowlist and marked verified.
- Record whether postbacks exist. Do not add parameters that are not in the account docs.
- After a documented destination exists, run one test click and compare the account report.

## 6. Backups

EXPORT CREATED AND DOWNLOADED; RESTORE NOT TESTED (2026-10-31). Render Recovery shows a successful logical database export created at 23:53 Kenya time on 2026-10-31. The owner confirmed downloading the `.dir.tar.gz` export. This confirms an export exists, but not that it can be restored. Keep backup/restore verification incomplete until a separate restore test succeeds.

Prepare, outside the app:

- Daily logical dump or continuous WAL archiving of the production database.
- Encrypt the dump before it leaves the database host.
- Store a second copy offsite.
- Keep at least 30 days.
- Alert if the latest successful backup is older than 26 hours.
- Restore into a separate database and run `SELECT count(*) FROM schema_migrations` before calling it tested.

Admin backup status must remain `NOT_CONFIGURED` until a separate restore succeeds. Do not mark backup/restore as fully verified based only on a successful export.

## 7. CDN/WAF

NOT CONFIGURED. No provider is selected.

Target path: client, DNS, CDN/WAF, origin HTTPS, Node app, PostgreSQL. The app already sends `nosniff`, `DENY` framing, and a restrictive content security policy. Pick a provider before claiming protection.

## 8. Staging to production

Do not run this until sections 1–3 have real values.

1. Set the required variables in the host secret store.
2. Create an empty database. Apply `sql/001_init.sql`, `sql/002_auth_and_config.sql`, and `sql/003_mfa_recovery.sql`, or let startup apply them.
3. Start the process with `NODE_ENV=production`. It must exit if MFA, password, session secret, or database settings are unsafe.
4. Check `GET /health` for `postgres: ok`.
5. Smoke: homepage, `/live/`, `/female/`, legal pages, admin login with TOTP, one allowlisted redirect, one rejected open redirect, BongaCash still disabled.
6. Terminate TLS at the CDN or a reverse proxy. Do not serve public HTTP.
7. Attach the selected CDN/WAF.
8. Rollback is: redeploy the previous release artifact and leave the database in place. Do not roll back additive migrations by dropping tables.
9. Watch `/health`, provider error fields, and postback rejects.
10. Confirm a tested restore exists before public traffic.

## 9. Final gate

| Item | Status |
|---|---|
| Embedded PostgreSQL tests | VERIFIED |
| Production startup refuses PGlite and JSON | VERIFIED in code |
| Owner TOTP library check | VERIFIED in unit tests |
| Authenticator-app scan | REQUIRES VERIFICATION |
| Chaturbate campaign id `C6yxN` | CONFIGURED |
| BongaCash campaign `840970` / RevShare label | CONFIGURED |
| BongaCash API, destination, PPS, postbacks | REQUIRES VERIFICATION |
| Chaturbate program, attribution, postback registration | REQUIRES VERIFICATION |
| Hosted PostgreSQL | VERIFIED AVAILABLE AND CONNECTED (2026-10-31) |
| Logical export | CREATED AND DOWNLOADED (2026-10-31) |
| Restore test | NOT TESTED |
| CDN/WAF | NOT CONFIGURED |
| HTTPS termination | NOT CONFIGURED |
| Production smoke test | NOT CONFIGURED |
| BongaCash rooms, redirects, postbacks | DISABLED |
| Email, Redis | DISABLED |
| Public production launch | BLOCKED |

Launch stays BLOCKED until hosted PostgreSQL works, Owner MFA works with a confirmed authenticator, backup and restore are tested, Chaturbate attribution is verified, required destinations are verified, security checks pass, CDN/WAF is ready, and production smoke tests pass.

## Manual vs code

You must do manually: choose the PostgreSQL host, create the database, set secrets in the host secret manager, enroll MFA, confirm Chaturbate and BongaCash account settings, register postbacks, choose CDN/WAF, enable backups, and run the restore test.

Safe to keep in code, already present: migration runner, production guards, disabled BongaCash path, allowlisted redirects, postback validation, health fields that do not claim backups succeeded.
