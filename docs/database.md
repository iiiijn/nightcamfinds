# Database

Production persistence is PostgreSQL via `DATABASE_URL` and `DATABASE_PROVIDER=postgres`.

Development default is embedded PGlite (`DATABASE_PROVIDER=pglite`), which runs the same SQL migrations. The JSON store is not used for business data.

Migrations:

- `sql/001_init.sql`
- `sql/002_auth_and_config.sql`

Applied by `src/db/connect.js` on startup. Do not edit production databases by hand.

# Backup

This application does not create infrastructure backups. Admin backup status stays `NOT_CONFIGURED` until an external job reports success.

Required for production:

- daily `pg_dump` or continuous WAL archiving
- 30-day retention minimum
- encrypted offsite copy
- restore test before launch

Restore: stop app, restore database, run migrations, start app, confirm providers and affiliate links.
