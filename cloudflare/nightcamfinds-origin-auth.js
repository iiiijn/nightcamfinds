/**
 * Cloudflare Worker for NightCamFinds origin authentication.
 * Bind NCF_ORIGIN_AUTH_SECRET as a Worker secret for BongaCash V2.
 * Optionally bind NCF_CLOUDFLARE_ORIGIN_SECRET as a separate Worker secret
 * for the affiliate redirect rate limiter. Never hard-code either secret.
 * Route this Worker to nightcamfinds.com/* (and www only if that hostname
 * is an active, proxied custom domain on Render).
 */
export default {
  async fetch(request, env) {
    const bongaSecret = env.NCF_ORIGIN_AUTH_SECRET;
    if (typeof bongaSecret !== "string" || bongaSecret.length < 32) {
      return new Response("Origin authentication is not configured", { status: 503 });
    }

    const cloudflareOriginSecret = env.NCF_CLOUDFLARE_ORIGIN_SECRET;
    if (cloudflareOriginSecret != null && cloudflareOriginSecret !== "" &&
        (typeof cloudflareOriginSecret !== "string" || cloudflareOriginSecret.length < 32)) {
      return new Response("Redirect origin authentication is misconfigured", { status: 503 });
    }

    const url = new URL(request.url);
    if (url.hostname !== "nightcamfinds.com" && url.hostname !== "www.nightcamfinds.com") {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers(request.headers);
    // Never forward visitor-supplied values. Each application integration has
    // its own secret and header, so rotating one does not silently rotate both.
    headers.delete("x-ncf-origin-auth");
    headers.set("x-ncf-origin-auth", bongaSecret);

    // The redirect limiter trusts CF-Connecting-IP only when this independent
    // secret matches NCF_CLOUDFLARE_ORIGIN_SECRET at the Render origin.
    headers.delete("x-ncf-cloudflare-auth");
    if (typeof cloudflareOriginSecret === "string" && cloudflareOriginSecret.length >= 32) {
      headers.set("x-ncf-cloudflare-auth", cloudflareOriginSecret);
    }

    return fetch(new Request(request, { headers }));
  }
};
