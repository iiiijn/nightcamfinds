# Phase A1.7 production security rollout

This runbook is intentionally staged. The application-side origin guard is inactive until `CF_ORIGIN_VERIFY_SECRET` is set in Render. Do not set it until the matching Cloudflare request-header transform rule is deployed and tested.

## 1. Cloudflare-to-Render origin verification

1. Generate a unique secret locally with `openssl rand -hex 32`. Do not paste it into chat, GitHub, source files, screenshots, or logs.
2. In Cloudflare, create a **Request Header Transform Rule**:
   - Name: `NightCamFinds origin verification`
   - Match expression: `http.host in {"nightcamfinds.com" "www.nightcamfinds.com"}`
   - Operation: **Set static**
   - Header: `x-ncf-origin-verify`
   - Value: the generated secret
   - Deploy the rule.
3. In Render, add `CF_ORIGIN_VERIFY_SECRET` with the exact same secret. Save and allow the service to redeploy.
4. Verify that `https://nightcamfinds.com` and `https://www.nightcamfinds.com` still load.
5. Verify that a direct request to `https://nightcamfinds.onrender.com/` receives HTTP 403. Do not change the Render inbound IP allowlist as a substitute.
6. Verify the Chaturbate callback endpoint still reaches its own shared-secret authentication. The application deliberately exempts only `/api/chaturbate/postback` and `/cb/postback` from the origin-header check because those endpoints independently validate `CB_POSTBACK_SECRET`.
7. If the public domain fails, remove `CF_ORIGIN_VERIFY_SECRET` from Render to disable the guard, then investigate the Cloudflare rule before trying again.

The request-header rule must overwrite the incoming header with its static value. Never use a rule that preserves a visitor-supplied value.

## 2. Cloudflare transport and edge security

Apply these as separate, tested production changes:

- Confirm the Render custom-domain certificate is valid before changing SSL mode from **Full** to **Full (strict)**.
- Set the minimum visitor TLS version to **TLS 1.2**. Keep TLS 1.3 enabled.
- Enable **Always Use HTTPS** after confirming HTTP redirects and callback URLs behave correctly.
- Enable the **Cloudflare Free Managed Ruleset** if it is not already attached to the zone entrypoint. Review events and false positives after deployment.
- Do not enable HSTS until every hostname intended to be covered has stable HTTPS. Do not enable preload or includeSubDomains without a separate domain inventory and approval.

Cloudflare documentation:
- https://developers.cloudflare.com/rules/transform/
- https://developers.cloudflare.com/rules/transform/request-header-modification/
- https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/
- https://developers.cloudflare.com/ssl/edge-certificates/additional-options/minimum-tls/

## 3. Admin and session credentials

In Render Environment, confirm these are present without copying their values anywhere:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `STATS_KEY`
- `CB_POSTBACK_SECRET`

Use unique high-entropy values for passwords and secrets. The application fails closed for dashboard login if `ADMIN_PASSWORD` or `SESSION_SECRET` is missing. Rotate a secret only with a planned coordinated update because existing sessions and provider callbacks may stop working.

## 4. Database backups and recovery

The production database is Render Postgres 18 on plan `0.1c-256mb`, with a 1 GB disk and external IP allowlist empty. Keep the external allowlist empty.

In the Render database dashboard:
1. Open **Recovery** and confirm whether point-in-time recovery is enabled and the exact retention window for this database plan.
2. Create a logical backup/export and record its timestamp and location.
3. Store a second encrypted copy outside the production database account.
4. Perform a restore test into a separate temporary database before treating the backup as proven.
5. Record the restore procedure and the latest successful restore-test date.

Do not run a restore against production as part of this phase without separate approval. A backup that has not been restored successfully is not yet a verified recovery plan.

## 5. Regression checks after rollout

After each production change, verify:

- Homepage, category pages, country pages, room feeds, and tracked affiliate redirects.
- Chaturbate postback authentication and idempotent duplicate handling.
- Dashboard login, session persistence, and logout.
- Provider diagnostics remain admin-protected.
- Cloudflare security events show no sustained false-positive blocks.
- Render logs show no new 4xx/5xx spikes or database connection failures.

Do not interpret a recorded redirect as a verified human visitor or a provider conversion. Keep click, registration, purchase, and revenue evidence separate.
