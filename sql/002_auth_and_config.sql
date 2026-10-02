-- 002_auth_and_config.sql
-- Auth, sessions, configuration versions. Applied by the migration runner.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_secret TEXT,
  mfa_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);

CREATE TABLE IF NOT EXISTS config_versions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  note TEXT,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_versions_key ON config_versions(key, created_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  username TEXT,
  ip TEXT,
  ok BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_room ON clicks(room_id);
CREATE INDEX IF NOT EXISTS idx_postbacks_tx ON postbacks((payload->>'transaction_id'));
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(type, created_at DESC);
