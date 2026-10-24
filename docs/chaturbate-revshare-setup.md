# Chaturbate RevShare setup for NightCamFinds

This guide describes the production event flow and the manual affiliate-account step that still must be completed by the owner.

## Revenue model

The Chaturbate account screenshot shows the RevShare program. Chaturbate's published affiliate terms describe 20% of adjusted gross receipts from referred members, a separate $50 eligible-broadcaster commission, and 5% referred-webmaster commission. Country tiers are used here to organize the browsing experience and segment traffic. They do **not** change the 20% RevShare rate, and NightCamFinds does not forecast or award a signup payout unless the account is eligible for that separate program and the actual postback reports one. Sources:

- https://support.chaturbate.com/hc/en-us/articles/360035947871-What-is-the-rev-share-program
- https://chaturbate.com/terms/appendix-b/

Do not infer revenue from a click or signup. Revenue is only recorded after a valid conversion postback with an actual payout value.

## Click path

1. A visitor opens a room card or promo link on NightCamFinds.
2. `server.js` creates one unique `click_id` and records the click in PostgreSQL.
3. The Chaturbate outbound URL retains the affiliate campaign ID from `CB_CAMPAIGN` / `CHATURBATE_WM`, uses a stable `track` bucket and passes both `click_id` and `sid`.
4. Chaturbate's Dynamic Postback sends a signup or purchase event to NightCamFinds.
5. The server checks the shared secret, checks that the click ID exists, validates the documented event type and payout, then upserts by `transaction_id`. Retries update the same transaction instead of adding duplicates.
6. The private dashboard sums actual event payouts, including negative payout adjustments. No event is counted when the postback is missing, unauthenticated, unrecognized, or unmatched to a NightCamFinds click.

## Chaturbate Dynamic Postback: owner setup required

The server endpoint is:

`https://nightcamfinds.com/api/chaturbate/postback`

In Chaturbate **Affiliates → Promo Tools → Postbacks → Dynamic Postbacks**, add a URL. Keep the static `secret` value private, and use the **same value already configured as Render's `CB_POSTBACK_SECRET`**. Do not paste it into GitHub or into a public message.

Use this template and replace `REPLACE_WITH_THE_RENDER_CB_POSTBACK_SECRET` with the existing secret locally in the Chaturbate form:

```text
https://nightcamfinds.com/api/chaturbate/postback?secret=REPLACE_WITH_THE_RENDER_CB_POSTBACK_SECRET&click_id={click_id}&source={source}&track={track}&transaction_id={transaction_id}&campaign_id={campaign_id}&program_id={program_id}&program_name={program_name}&user_id={user_id}&type={type}&payout={payout}&currency={currency}&amount={amount}&timestamp={timestamp}&country={country}&device={device}&language={language}&region={region}&attempt={attempt}
```

Select the relevant RevShare signup and purchase events in the Chaturbate settings. Chaturbate supports GET and POST for Dynamic Postbacks; this endpoint accepts both. Official guide: https://support.chaturbate.com/hc/en-us/articles/46807452461588-Postbacks-for-Affiliates

Never test by inventing a payout. After the URL is saved in Chaturbate, trigger a legitimate test/real event according to the partner's testing options and confirm that the matching transaction appears in the private dashboard.

## Tour codes

The category tour defaults below came from the owner's Link Codes screenshot. They are configurable in Render and should be checked against the live Link Codes page if Chaturbate rotates them:

- General / current top room: `hr8m`
- Female: `uhEc`
- Male: `EyCi`
- Trans: `2MTk`
- Couples: `43Qk`

The partner room URL from the live Users Online feed is preferred when available. The campaign is always preserved as the affiliate campaign ID; marketing attribution is stored separately as UTM data and is never written over the affiliate campaign.

Render environment variables supported by the app are `CHATURBATE_WM`, `CB_CAMPAIGN`, `CB_TOUR_GENERAL`, `CB_TOUR_FEMALE`, `CB_TOUR_MALE`, `CB_TOUR_TRANS`, `CB_TOUR_COUPLES`, and `CB_POSTBACK_SECRET`. Keep all secret values in Render only.

## Promo-tool choices

- **Users Online API:** power live discovery and room cards. Refresh through the existing server cache; do not save old broadcast thumbnails for reuse after a room goes offline.
- **Link Codes / tours:** use the correct RevShare link code for the category, with server-managed click IDs.
- **Dynamic Postbacks:** required for purchase revenue reporting and reconciliation.
- **Banners:** use official account-provided banner/image URLs only. Configure them in the private promo config; do not fabricate creative or claim a placeholder is an official banner.
- **Cam Listing / Embed Cam / Popup / RSS/Atom / pre-roll / text ads:** leave optional until each official code/feed has been copied from the affiliate account and separately tested. The custom room-card experience is preferred for SEO and click-level tracking.

## SEO and audience coverage

Category and country routes are server-rendered with distinct titles, descriptions and canonical URLs. Room tags are treated as untrusted partner data and shown as text, not HTML. Country-tier classification is used only for country-specific signup reporting; it must not be presented as changing RevShare rates. Keep the site clearly identified as an independent directory and follow Chaturbate's affiliate restrictions: https://chaturbate.com/terms/appendix-b/
