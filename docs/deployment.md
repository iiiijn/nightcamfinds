# Deployment

Production startup refuses to continue when:

- `DATABASE_PROVIDER` is not `postgres`
- `DATABASE_URL` is missing
- admin password is `change-me` or shorter than 12 characters
- `SESSION_SECRET` is missing, short, or still the example
- BongaCash is enabled without an API base
- BongaCash postbacks are enabled
- Chaturbate is enabled without `CHATURBATE_WM`

Owner MFA must be enrolled with a 40-character hex `OWNER_MFA_SECRET` before production. Startup exits if it is missing. See `docs/production-readiness.md`.

No CDN, WAF, hosted database, or backup is configured in this repository. Public launch is BLOCKED.
