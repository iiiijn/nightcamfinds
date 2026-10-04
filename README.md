# NightCamFinds fix

This replaces the current Render service. It is Chaturbate-only and keeps campaign `C6yxN` and tour `LQps`.

What changed:
- Age gate is stored once and hidden before paint.
- Privacy and terms no longer say they are drafts.
- Room text is cleaned before it is sent to the browser.
- Cards use partner thumbnails and a Watch live link.
- Country filter is built from rooms that actually have a country code.
- Tier-1 visitors are pre-filtered when Cloudflare sends `CF-IPCountry`.
- Each placement has its own track id.
- Every room link goes to Chaturbate with a placement track id.
- Sitemap, robots.txt, and a share image are included.
- The last good feed is kept if Chaturbate times out.

Deploy:
1. In Render, open the NightCamFinds service and replace the repo with this folder, or upload these files over the old ones.
2. Start command: `node server.js`
3. Set `PUBLIC_ORIGIN` to the public URL, ideally your own domain.
4. Point a custom domain at the service. The onrender.com URL can stay as a redirect.

This chat cannot push to the existing Render account. The live site will not change until these files are deployed there.
