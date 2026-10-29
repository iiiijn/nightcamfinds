# Phase 1: attribution and country routing

## Attribution

Tracked outbound requests continue to use the existing `/go/` and `/bgo/` redirect paths and the existing click identifier passed to partner links. The request parser now captures country, platform, category, placement, device, referrer host, page type, card position, UTM source/medium/campaign/content and a bounded sub-ID.

The richer event write is best-effort and only runs when `click_attribution_events` exists. This keeps the current redirect path operational before the new migration is approved and applied. The legacy `affiliate_clicks` and Chaturbate click records remain the existing attribution sources.

Bot-like user agents are marked in the richer event table; they are not silently deleted from the legacy click records. This is intentionally conservative until bot filtering can be validated against real traffic.

## Metrics

The dashboard stats API includes `countryPlatformPerformance` with clicks, signups, payers, reported revenue and EPC. Engaged clicks are returned as unknown (`null`) until an authoritative source is integrated; they must not be inferred from raw click counts. Conversion values are attributed to the country and partner reported by postbacks, so unmatched and missing-country events need review before making routing decisions.

EPC is calculated as reported revenue divided by tracked clicks. Revenue currency consistency and postback classification must be checked before comparing platforms.

## Country routing

Supported initial markets: US, GB, CA, AU, DE, FR and NL. Routing preferences default to unassigned. A hypothesis is not a live preference. The public read endpoint returns only approved settings, while the authenticated dashboard can inspect all settings. Hypotheses and unassigned states can be saved without affecting visitors. The dashboard's separate “Approve live” action requires a documented hypothesis and an explicit browser confirmation before the authenticated API activates that country's preference. No country preference is pre-approved by default.

The second platform remains available as an alternative. No platform is assumed to be more familiar or popular in a country without evidence.

## Migration

`sql/004_country_routing_attribution.sql` is additive and creates the richer attribution event table. Country preferences are stored in the existing `system_settings` table and do not require a separate settings-table migration. The attribution migration must not be applied to production until separately authorized. Until it is applied, the new event insert is best-effort and legacy tracking continues.

## Operational notes

- Do not use a test postback as evidence of a signup or payer.
- Do not compare EPC when the currencies or attribution windows differ.
- Do not auto-switch country preferences based on low-volume data.
- Keep live partner URLs, campaign identifiers, and postback configuration unchanged unless separately approved.
