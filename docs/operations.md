# Operations notes

## Disaster recovery

Runtime state for this build is `data/store.json`. Production should use PostgreSQL from `sql/001_init.sql`.

Target RPO is 1 hour once automated backups exist. They do not exist in this environment. A backup is not reliable until a restore test is done.

Restore steps for the file store: stop the process, replace `data/store.json` from a copy, start again.

## Incident

1. Disable affiliate redirects in Admin.
2. Disable the failing provider.
3. Confirm the public page shows the honest empty state instead of expired rooms.
4. Do not invent revenue adjustments.

## Launch checklist

- Confirm Chaturbate program in the affiliate account.
- Register `https://YOUR_DOMAIN/postback/chaturbate?click_id={click_id}&transaction_id={transaction_id}&payout={payout}&currency={currency}&type={type}` only after reviewing current Chaturbate macro docs.
- Do not enable BongaCash redirects until a destination URL is verified.
- Change admin password.
- Put the app behind HTTPS, a WAF, and a CDN.
- Run `npm test` and a provider-failure smoke test.
