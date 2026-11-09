# Chaturbate dynamic postback setup

This endpoint is served by the production Node runtime:

`https://nightcamfinds.com/api/chaturbate/postback`

Chaturbate's current affiliate documentation describes dynamic postbacks as server-to-server GET or POST callbacks. It documents `click_id`, `transaction_id`, `type`, `payout`, `currency`, `amount`, `country`, `track`, `source`, `campaign_id`, `program_id`, `program_name`, `user_id`, `token`, `timestamp`, `date`, `time`, `device`, `language`, `referral`, `attempt`, and `region`.

## URL configuration

Configure the callback in the Chaturbate Affiliate Program's Dynamic Postbacks page. A URL can use the following parameter mapping (select GET or POST):

```text
https://nightcamfinds.com/api/chaturbate/postback?click_id={click_id}&transaction_id={transaction_id}&type={type}&payout={payout}&currency={currency}&amount={amount}&country={country}&track={track}&source={source}&campaign_id={campaign_id}&program_id={program_id}&program_name={program_name}&user_id={user_id}&token={token}&timestamp={timestamp}&date={date}&time={time}&device={device}&language={language}&referral={referral}&attempt={attempt}&region={region}&secret=REPLACE_WITH_CB_POSTBACK_SECRET
```

The final `secret` parameter is a NightCamFinds static shared-secret parameter, not a Chaturbate macro. Its value must exactly match the Render environment variable `CB_POSTBACK_SECRET`. Keep the value private. Do not commit it, paste it into source files, or share it in screenshots. If you rotate the secret, update both Render and the Chaturbate callback URL together.

The application currently validates this static `secret` parameter using a constant-time comparison. Chaturbate's documentation also mentions an optional Validation Salt for checksum validation, but the public documentation does not specify a checksum field or algorithm. Do not assume the Validation Salt is equivalent to the NightCamFinds `secret` parameter. Only enable checksum validation after confirming the exact Chaturbate-generated signature format and implementing its documented verification.

## Event handling

- The endpoint accepts GET and POST form or JSON requests.
- The nine documented Chaturbate event types are accepted.
- Incomplete macro-test requests are acknowledged without writing a conversion.
- A real event must include a click ID, unique transaction ID, supported event type, numeric payout, and the configured shared secret.
- Duplicate transaction IDs are ignored.
- Events are marked matched only when their click ID exists in the Chaturbate provider click ledger or the primary affiliate click ledger for the Chaturbate platform.
- Unmatched callbacks are acknowledged but remain excluded from verified earnings.
- Payouts remain grouped by currency. Do not treat non-USD amounts as USD.

## Verification checklist

1. Confirm `CB_POSTBACK_SECRET` exists in Render without sharing its value.
2. Configure the URL above in the Chaturbate Dynamic Postbacks page, replacing only the static secret placeholder with the same private value.
3. Use Chaturbate's test function. The test must return success and must not create a conversion row.
4. Generate a real test conversion only through an approved account/test flow. Confirm the transaction appears once and has `matched_click = true`.
5. Compare the transaction and payout with Chaturbate Affiliate Stats before treating it as verified revenue.

Official documentation: https://support.chaturbate.com/hc/en-us/articles/46807452461588-Postbacks-for-Affiliates
