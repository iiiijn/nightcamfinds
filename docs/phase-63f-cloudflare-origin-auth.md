# Phase 63F: Cloudflare-to-Render origin authentication

## Purpose

BongaCash V2 requires the visitor IPv4 address in `client_ip`. A public Render
origin must not trust `CF-Connecting-IP` by itself because a direct request to
the Render hostname can supply an arbitrary header.

The application therefore requires both:
- A valid single IPv4 address in `CF-Connecting-IP`.
- A matching shared secret in `X-NCF-Origin-Auth`, added by the Cloudflare Worker.

The application compares the secret using a constant-time comparison and rejects
missing or short configured secrets. V1 remains the default.

## Cloudflare Worker

Worker source: `cloudflare/nightcamfinds-origin-auth.js`.

1. Create a Worker and paste the source.
2. Add Worker secret binding `NCF_ORIGIN_AUTH_SECRET`. Generate a random secret
   of at least 32 characters. Do not commit it or paste it into chat.
3. Attach the Worker route `nightcamfinds.com/*`. Add `www.nightcamfinds.com/*`
   only if www is an active custom domain and is proxied through Cloudflare.
4. Confirm the Worker route covers every hostname used by visitors and that
   requests reach the Render custom domain through Cloudflare.
5. Set the identical secret in Render as `BONGACAMS_ORIGIN_AUTH_SECRET` using
   the Render dashboard's secret/environment variable control.

## Render and activation order

1. Keep `BONGACAMS_API_VERSION` unset or set to `1` during setup.
2. Deploy the Worker and verify it overwrites any visitor-supplied
   `X-NCF-Origin-Auth` value.
3. Confirm the custom domain is proxied through Cloudflare.
4. Disable the Render `onrender.com` subdomain in Render Settings after
   confirming the custom domain works. This prevents direct access through the
   default Render hostname.
5. Verify direct requests to the Render hostname return 404, and normal
   custom-domain requests still work.
6. Only after those checks, set `BONGACAMS_TRUSTED_CLIENT_IP_HEADER` to
   `cf-connecting-ip` and consider enabling V2 in a separately approved change.

## Important limitations

- Render's documented web-service IP allow-list feature requires Scale or
  Enterprise, so it is not the recommended path for the current Starter service.
- Cloudflare Authenticated Origin Pulls (mTLS) cannot be assumed to work with
  Render's managed origin TLS termination. This design uses a Worker-injected
  shared secret instead.
- A Worker secret does not make the public site itself private. It authenticates
  Cloudflare-originated requests to the application for the protected V2 path.
- Do not activate V2 until Worker routing, secret equality, direct-origin
  rejection, and the live visitor IP observed at the origin are verified.
