/**
 * Cloudflare Worker for NightCamFinds origin authentication.
 * Bind NCF_ORIGIN_AUTH_SECRET as a Worker secret. Never hard-code it here.
 * Route this Worker to nightcamfinds.com/* (and www only if that hostname
 * is an active, proxied custom domain on Render).
 */
export default {
  async fetch(request, env) {
    const secret = env.NCF_ORIGIN_AUTH_SECRET;
    if (typeof secret !== "string" || secret.length < 32) {
      return new Response("Origin authentication is not configured", { status: 503 });
    }

    const url = new URL(request.url);
    if (url.hostname !== "nightcamfinds.com" && url.hostname !== "www.nightcamfinds.com") {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers(request.headers);
    // Never forward a visitor-supplied value. The Worker overwrites it.
    headers.delete("x-ncf-origin-auth");
    headers.set("x-ncf-origin-auth", secret);

    return fetch(new Request(request, { headers }));
  }
};
