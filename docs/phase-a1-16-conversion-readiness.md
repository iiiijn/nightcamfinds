# Phase A1.16: affiliate conversion readiness audit

Audit basis: source code on main after Phase A1.15 merge, repository documentation, and publicly accessible provider documentation reviewed on 2026-11-16. This is a code/documentation audit, not an inspection of either affiliate account's private settings and not a live conversion test.

## Chaturbate: implementation findings

- Outbound Chaturbate URL construction includes the locally generated identifier as both `click_id` and `sid`. The production callback normalizer accepts `click_id` and aliases, requires a non-empty click ID, transaction ID, supported event type, and numeric payout.
- The callback accepts GET and POST (form-urlencoded or JSON), and requires the static `secret` parameter to match Render's `CB_POSTBACK_SECRET`. Authentication uses a constant-time comparison. Missing configuration returns 503; a missing or incorrect supplied secret returns 403.
- Unresolved documented macro placeholders are acknowledged without saving a conversion. The secret is removed from the payload before persistence.
- The conversion ledger uses a unique transaction ID, ignores an identical duplicate, and rejects a conflicting duplicate. Click matching checks the Chaturbate click ledger and the primary click ledger restricted to platform `chaturbate`.
- Dashboard earnings are limited to matched supported Chaturbate event types and remain grouped by currency. The legacy USD money card reads USD only. Unmatched callbacks are not included in verified earnings.

## Chaturbate: unresolved external verification

The official public postback article describes Dynamic Postbacks, GET/POST delivery, supported macros, and optional Validation Salt/checksum validation. It does not document the NightCamFinds static `secret` parameter or specify the checksum algorithm. Therefore public documentation alone cannot establish that the affiliate account UI will send the static constant exactly as configured, or that the account is configured at all.

Do not enable the callback in the affiliate account until the owner confirms the Dynamic Postbacks page accepts the static `secret` query parameter, and the exact configured URL and delivery method are reviewed without exposing the secret. If the UI does not support a static constant parameter, the current callback authentication method is not ready for activation. Do not substitute Validation Salt for `CB_POSTBACK_SECRET`; checksum validation remains unimplemented.

The official macro reference lists `click_id` as an affiliate-supplied passthrough value and `transaction_id` as the unique conversion event ID. The site generates local IDs within its own limit; the live account must still be checked to confirm the correct campaign/program and that click IDs are retained and returned.

## BongaCash: implementation and evidence findings

- The active BongaCams room-feed configuration is separate from conversion attribution.
- The current automatic callback endpoint remains intentionally unsupported (HTTP 410); the application does not pass its local click ID through the current Direct Link destination. BongaCash automatic conversion matching must remain disabled and revenue must not be inferred from click counts.
- The public BongaCash FAQ describes PPS, RevShare, PPS + RevShare, affiliate promotional tools and account statistics. The public page reviewed does not document a server-to-server postback endpoint, supported click-ID macro, or callback signature. This does not prove that no such feature exists inside a logged-in account or is available from support.

Before implementation, the owner must inspect the logged-in BongaCash account and ask support in writing whether the selected program supports (1) click-ID passthrough on the destination, (2) a conversion postback, (3) the exact macros for click ID, transaction ID, event type, payout and currency, and (4) request authentication/signature. Save the provider's actual URL/template or written response. Do not invent parameter names or activate a guessed callback.

## Reporting safeguards verified in source

- Clicks, unmatched callback events, matched callback events, and reported payouts are distinct concepts.
- Revenue reporting is based on matched supported Chaturbate callback events, not outbound clicks.
- Currency is preserved; non-USD payout values are not added to the USD headline.
- BongaCash automatic attribution remains unavailable and is not presented as connected.

## Owner actions required before real conversion verification

1. In Chaturbate Affiliate Program, confirm the active campaign and payout program; inspect Dynamic Postbacks and determine whether a static `secret` parameter can be configured alongside the documented macros.
2. Confirm the actual Render variable `CB_POSTBACK_SECRET` exists without copying its value into chat, screenshots, GitHub, or this document.
3. Only after steps 1–2 are confirmed, use the provider's macro/test function. Confirm it returns success and creates no conversion row. Do not generate a paid or real conversion solely for testing.
4. In BongaCash, confirm the active program and ask support for documented click-ID passthrough and callback specifications. Until then use account-stat reconciliation and keep automatic callback status disabled.
5. For any first real provider event that occurs naturally, compare its transaction, click ID, event type, payout and currency against the provider's own report before treating it as verified revenue.

## Scope and limitations

No production database was queried or changed in this phase. No affiliate redirect was clicked, no callback was sent, no conversion was fabricated, no provider account was accessed, no secret or environment variable was changed, and no production configuration was changed. Public documentation cannot verify private account settings or prove that a real postback has been received.
