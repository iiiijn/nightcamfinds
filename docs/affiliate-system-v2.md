# NightCamFinds Affiliate System v2

## Goal

NightCamFinds is a discovery and affiliate site for two partner platforms:

- Chaturbate
- BongaCams / BongaCash

The site must turn traffic into measurable affiliate revenue, not just display live rooms.

## Core flow

```text
Visitor
  -> NightCamFinds landing/page
  -> traffic attribution captured
  -> live room feed
  -> tracked /go or /bgo redirect
  -> affiliate platform
  -> partner postback
  -> conversion matched to click_id
  -> revenue stored
  -> private dashboard
```

## System modules

### 1. Provider adapters

Each provider has one adapter with the same normalized room shape:

```text
id
platform
username
displayName
gender
country
viewerCount
image
roomSubject
isHd
isNew
languages
href
```

The UI never needs to know the provider's raw API format.

### 2. Feed cache

The public site should not call partner APIs for every visitor request.

Use a short server-side cache with stale fallback:

- fetch fresh feed on cache miss
- serve cached feed during the cache window
- keep the last good feed when a provider times out
- never expose partner API credentials to the browser

### 3. Affiliate router

All outbound monetized links go through NightCamFinds first:

- `/go/...` for Chaturbate
- `/bgo/...` for BongaCams

The router creates a unique `click_id`, stores attribution, then redirects to the partner URL.

The browser must never receive the raw affiliate configuration used to construct the destination.

### 4. Attribution

Every click can carry:

- source
- medium
- campaign
- content
- landing page
- category
- placement
- platform
- country
- device
- click_id

UTM/source data is captured on the first landing and retained during internal navigation.

### 5. Conversion tracking

Partner postbacks are accepted server-to-server.

A conversion is considered attributable only when its `click_id` matches a NightCamFinds-issued click.

Store the raw postback as well as normalized fields so the mapping can be corrected later without losing source data.

### 6. Revenue ledger

Revenue is stored independently from traffic statistics.

Minimum conversion fields:

```text
provider
click_id
transaction_id
conversion_type
payout
currency
amount
country
event_timestamp
raw_payload
```

`transaction_id` must be idempotent so a repeated postback does not double-count revenue.

### 7. Private dashboard

The dashboard should answer these questions in under 30 seconds:

1. How many visitors/clicks did I get?
2. Which platform received the clicks?
3. Which countries generated them?
4. Which traffic sources generated them?
5. Which pages and placements generated them?
6. How many signups/conversions happened?
7. How much revenue was generated?
8. What is the conversion rate?
9. Which platform is winning?
10. Which traffic source should receive more effort?

## Dashboard sections

### Overview

- visitors
- affiliate clicks
- Tier-1 clicks
- signups
- purchases
- earnings
- click-to-signup rate
- click-to-purchase rate
- revenue per click

### Traffic

- source
- medium
- campaign
- country
- device
- landing page

### Affiliate

- Chaturbate vs BongaCams
- clicks
- signups
- purchases
- earnings
- EPC

### Content

- page
- category
- placement
- room/model
- outbound clicks

### Conversion ledger

- click_id
- transaction_id
- provider
- event
- payout
- country
- timestamp
- matched/unmatched status

## Security rules

- Keep provider credentials in Render environment variables.
- Never commit live API secrets.
- Protect the dashboard with an authenticated session.
- Do not expose conversion or revenue endpoints publicly without validation.
- Validate provider postbacks before accepting them as revenue.
- Keep raw postback payloads for debugging.

## Important implementation decision

The current repository contains both `start.js` and `route.js`, plus startup patch scripts that mutate runtime files. That is useful during rapid development, but it is not the final architecture.

System v2 should converge on one canonical server runtime and remove runtime source-code patching. Provider adapters, tracking, postbacks, and dashboard queries should become normal modules with tests.

## Build order

1. Canonical server runtime
2. Shared provider interface
3. Chaturbate adapter
4. BongaCams adapter
5. Feed cache
6. Unified tracked redirect
7. Click attribution persistence
8. Chaturbate postback
9. BongaCash postback
10. Conversion/revenue ledger
11. Dashboard API
12. Dashboard UI
13. Automated tests
14. Production deployment verification

## Definition of done

A visitor can arrive from X, Google, Reddit, Telegram, or direct traffic, browse live rooms, click a room, and be redirected through a NightCamFinds tracking URL. The system records the click, identifies the provider and traffic source, receives the partner conversion, matches it to the click, stores the payout once, and shows the result in the private dashboard.
