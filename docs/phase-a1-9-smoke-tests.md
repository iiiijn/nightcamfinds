# Phase A1.9: isolated read-only production smoke tests

This phase adds an opt-in smoke-test runner. It does not change application routes, database schemas, Render settings, Cloudflare settings, or production secrets.

## Run against production

From a trusted local terminal with Node.js 20 or newer:

```bash
NCF_SMOKE_BASE_URL=https://nightcamfinds.com node scripts/smoke-production.js
```

On PowerShell:

```powershell
$env:NCF_SMOKE_BASE_URL = "https://nightcamfinds.com"
node scripts/smoke-production.js
```

The runner sends sequential GET requests only. It does not follow redirects and does not open `/go/` or `/bgo/` tracked affiliate links. It checks the homepage, public category pages, health, Chaturbate summary feed, BongaCams feed, dashboard shell, anonymous dashboard API rejection, unauthenticated Chaturbate callback rejection, and the documented BongaCash 410 response.

The callback probes omit the provider secret and therefore must be rejected before conversion persistence. No valid callback or synthetic conversion is sent. The dashboard shell is public HTML; its protected data APIs must reject anonymous access.

## Limits

- A successful smoke test confirms HTTP availability and basic response contracts, not that every room is online or that partner affiliate systems accept tracking parameters.
- Tracked redirect behavior is covered by unit/contract tests. Do not probe a real `/go/` or `/bgo/` route against production unless owner traffic is explicitly excluded or a dedicated non-production test environment is approved. A redirect can create a real analytics record.
- Provider callback success, conversion matching, and revenue attribution require a provider-issued test callback with a test transaction ID. Do not fabricate production conversion data.
- The runner is opt-in and is not part of `npm test`; CI tests the runner using mocked fetch responses only.

## Expected result

All checks should pass. A failed route should be investigated before enabling the Cloudflare origin verification secret or making further edge-security changes.
