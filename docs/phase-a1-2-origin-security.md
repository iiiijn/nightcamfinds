# Phase A1.2: Cloudflare and Render origin security

## Scope

This phase prepares the application-side integration and verification. It does
not change Render settings, Cloudflare routes, DNS, database allowlists, plans,
or production secrets.

## Origin authentication headers

The existing Cloudflare Worker supports BongaCash V2 with:

- Worker secret binding: `NCF_ORIGIN_AUTH_SECRET`
- Render secret: `BONGACAMS_ORIGIN_AUTH_SECRET`
- Header: `X-NCF-Origin-Auth`

The affiliate redirect rate limiter uses a separate trust boundary:

- Worker secret binding: `NCF_CLOUDFLARE_ORIGIN_SECRET`
- Render secret: `NCF_CLOUDFLARE_ORIGIN_SECRET`
- Header: `X-NCF-Cloudflare-Auth`

Both secrets must be independently generated random values of at least 32
characters. Never commit them, put them in source code, or paste them into chat.
The Worker deletes any visitor-supplied copy of either header before setting
the corresponding value from its secret binding.

The redirect limiter trusts `CF-Connecting-IP` only when the
`X-NCF-Cloudflare-Auth` value matches the Render secret using a
constant-time comparison. If the optional redirect secret is not configured
on the Worker, the Worker removes any visitor-supplied header and does not add
one. In that state the application must not treat `CF-Connecting-IP` as
authenticated.

## Production activation order

1. Confirm the Worker source and tests in this PR.
2. Generate a new redirect-origin secret in a password manager. Do not send it
   in chat or commit it.
3. Add it as a Worker secret named `NCF_CLOUDFLARE_ORIGIN_SECRET`.
4. Add the identical value to the Render web service as
   `NCF_CLOUDFLARE_ORIGIN_SECRET`. Keep existing environment variables.
5. Confirm the Worker route is attached to the active, proxied hostname(s).
   The main hostname is proxied. Add `www` only after confirming it is an
   active custom domain on the Render service.
6. Test normal site pages and both affiliate redirect paths, including
   requests containing forged visitor-supplied authentication headers.
7. Verify the application accepts the authenticated Cloudflare IP and rejects
   an unauthenticated or forged header. Do not claim per-IP protection until
   these tests pass.

Do not change BongaCash V2 settings as part of this phase. Its existing secret
and header remain independent.

## Render origin exposure and plan limitation

The Render web service currently uses Starter. Render inbound IP allowlisting
for web services requires Scale or Enterprise. Do not attempt to apply an
unsupported allowlist or upgrade the service without explicit cost approval.

A shared secret prevents an arbitrary direct-origin caller from forging the
trusted Cloudflare client-IP header, but it does not make the public Render
hostname inaccessible. On Starter, direct-origin access remains a separate
risk. Evaluate the cost of a supported Render plan or a different origin
architecture before claiming the origin is locked to Cloudflare.

## Database network restriction

Do not edit the Postgres allowlist until the service's actual connection path
is verified. Confirm the web service uses Render's internal database URL and
that an external administrator connection is not needed. Restricting the
allowlist must be a separately reviewed production operation with a tested
rollback path.

## Acceptance criteria

- Existing BongaCash origin authentication behavior is unchanged.
- The Worker overwrites, rather than forwards, visitor-supplied auth headers.
- Redirect origin authentication uses its own secret and header.
- Missing redirect secret means no authenticated Cloudflare IP is trusted.
- Existing affiliate redirect behavior remains available.
- No production secret, DNS route, IP allowlist, Render plan, or database
  setting is changed by this PR.
