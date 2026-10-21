# NightCamFinds dual-affiliate rollout

## Goal
Run one NightCamFinds directory with separate Chaturbate and BongaCash room feeds and attribution. Keep partner identity clear on every room card and review page.

## Current integration status
- Chaturbate room feed adapter exists in `src/adapters/chaturbate.js` and relies on `CHATURBATE_WM`. Validate that the account identifier used for feed access matches the affiliate account configuration. The user-provided join link is `tour=LQps`, `campaign=C6yxN`, `track=default`, and `room=masterteja`; do not overwrite the provided tracking values without checking the partner's rules.
- BongaCash feed adapter exists in `src/adapters/bongacash.js` and requests the promo XML feed using campaign `840970`. The owner-provided tracking link is `https://bongacams4.com/track?c=840970`. Confirm feed availability, room destination URL format, and affiliate attribution requirements against the account dashboard or official documentation before enabling redirects.
- BongaCash conversion/postback handling is deliberately marked unverified. Do not report registrations or revenue as tracked until the account confirms the postback/reporting fields.

## Implementation principles
1. Do not automatically enable a provider just because its feed returns non-empty data.
2. Preserve the last successful feed snapshot when a refresh fails, with a visible stale status and timestamp.
3. Attribute each click to provider, room, page/category, campaign and source. Never imply that an outbound click is a confirmed registration.
4. Keep redirect hosts allowlisted; do not implement a user-controlled destination URL.
5. Keep Chaturbate and BongaCash data separate in the dashboard. Show registrations/revenue as unavailable where conversion data is not verified.
6. Update affiliate disclosure to name both programs and make the commercial relationship obvious near relevant offers.
7. Test feed parsing, timeouts, invalid payloads, room URLs, redirects, click persistence and provider-specific counts before deployment.

## Launch checklist
- [ ] Chaturbate API feed returns rooms with the expected account and affiliate URLs.
- [ ] BongaCash promo feed returns valid XML and tracked `chat_url` values.
- [ ] Provider enablement is explicit and persistent.
- [ ] Failed feed refresh does not immediately make the whole directory appear empty if a recent safe snapshot exists.
- [ ] Cards label the provider and route through the provider-specific tracked redirect.
- [ ] Clicks are counted separately by provider, campaign, page, category, country and source.
- [ ] Postback setup is verified per partner before displaying conversion/revenue figures.
- [ ] Test suite passes and a pull request is reviewed before production deployment.
- [ ] Deployment is verified on the live domain after merging.

## Owner-provided affiliate links
- Chaturbate: `https://chaturbate.com/in/?tour=LQps&campaign=C6yxN&track=default&room=masterteja`
- BongaCash: `https://bongacams4.com/track?c=840970`

Affiliate campaign identifiers are not passwords. Do not commit API keys, dashboard passwords, postback secrets, session secrets or database credentials.