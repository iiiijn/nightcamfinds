# Verification registry

| Component | Status |
|---|---|
| PostgreSQL schema and repository | VERIFIED against embedded Postgres in tests |
| Hosted PostgreSQL backup | NOT_CONFIGURED |
| JSON business store | DISABLED |
| Chaturbate API v2 | VERIFIED documented; live account not called in unit tests |
| Chaturbate campaign C6yxN | CONFIGURED |
| Chaturbate program | REQUIRES_CONFIRMATION |
| Chaturbate postback endpoint | CONFIGURED locally; provider registration REQUIRES_VERIFICATION |
| BongaCash campaign 840970 / RevShare | CONFIGURED |
| BongaCash API, PPS, destination, postbacks | REQUIRES_VERIFICATION |
| Owner MFA algorithm | VERIFIED in unit tests: RFC 6238 HMAC-SHA1, 30-second step, 6 digits, Base32 secret, otpauth URI, replay rejection |
| Owner MFA authenticator-app scan | REQUIRES VERIFICATION until you scan the one-time QR with your app |
| Owner MFA secret storage | CONFIGURED to read OWNER_MFA_SECRET only. Not written to the database, frontend bundle, or docs |
| MFA recovery codes | VERIFIED as single-use hashes in unit tests. Database consume path is in sql/003_mfa_recovery.sql |
| Email / Redis | DISABLED / optional |
