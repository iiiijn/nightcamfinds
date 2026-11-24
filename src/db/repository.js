import fs from "node:fs";
import path from "node:path";

function statements(sql) {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.split("\n").every((line) => !line.trim() || line.trim().startsWith("--")));
}

export async function migrate(db, sqlDir) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
  const applied = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const existing = await db.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
    if (existing.rows.length) continue;
    const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
    await db.query("BEGIN");
    try {
      for (const statement of statements(sql)) await db.query(statement);
      await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await db.query("COMMIT");
      applied.push(version);
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }
  return applied;
}

export function createRepository(db) {
  return {
    async health() {
      const res = await db.query("SELECT 1 AS ok");
      return res.rows[0]?.ok === 1;
    },
    async upsertProvider(row) {
      await db.query(
        `INSERT INTO providers (id, name, status, api_version, program, campaign, enabled, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name=$2, status=$3, api_version=$4, program=$5, campaign=$6, enabled=$7, notes=$8, updated_at=now()`,
        [row.id, row.name, row.status, row.apiVersion || null, row.program || null, row.campaign || null, Boolean(row.enabled), row.notes || null]
      );
    },
    async providers() {
      const res = await db.query("SELECT * FROM providers ORDER BY id");
      return res.rows;
    },
    async saveCampaign(row) {
      await db.query(
        `INSERT INTO campaigns (id, provider_id, name, program, external_campaign, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET provider_id=$2, name=$3, program=$4, external_campaign=$5, status=$6`,
        [row.id, row.providerId, row.name, row.program, row.externalCampaign, row.status]
      );
    },
    async campaigns() {
      return (await db.query("SELECT * FROM campaigns ORDER BY id")).rows;
    },
    async saveLink(row) {
      await db.query(
        `INSERT INTO affiliate_links (id, provider_id, campaign, program, destination_type, url_template, affiliate_domain, status, verification_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET status=$8, verification_status=$9, notes=$10, updated_at=now()`,
        [row.id, row.providerId, row.campaign, row.program, row.destinationType, row.urlTemplate || null, row.domain || null, row.status, row.verificationStatus, row.notes || null]
      );
    },
    async links() {
      return (await db.query("SELECT * FROM affiliate_links ORDER BY id")).rows;
    },
    async upsertRoom(room) {
      await db.query(
        `INSERT INTO rooms (id, provider, external_username, display_name, gender, age, country, image, room_subject, is_live, is_hd, is_new, viewer_count, tags, languages, room_url, freshness, last_seen_at, provider_metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18,$19::jsonb)
         ON CONFLICT (id) DO UPDATE SET display_name=$4, gender=$5, age=$6, country=$7, image=$8, room_subject=$9, is_live=$10, is_hd=$11, is_new=$12, viewer_count=$13, tags=$14::jsonb, languages=$15::jsonb, room_url=$16, freshness=$17, last_seen_at=$18, provider_metadata=$19::jsonb`,
        [room.id, room.provider, room.externalUsername, room.displayName, room.gender, room.age, room.country, room.image, room.roomSubject, room.isLive, room.isHd, room.isNew, room.viewerCount, JSON.stringify(room.tags || []), JSON.stringify(room.languages || []), room.roomUrl, room.freshness, room.lastSeenAt, JSON.stringify(room.providerMetadata || {})]
      );
    },
    async rooms(provider) {
      const res = provider
        ? await db.query("SELECT * FROM rooms WHERE provider = $1", [provider])
        : await db.query("SELECT * FROM rooms");
      return res.rows;
    },
    async insertClick(row) {
      await db.query(
        `INSERT INTO clicks (click_id, session_id, provider, campaign, program, room_id, page, category, country, language, traffic_source, traffic_medium, traffic_campaign, device, destination, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())`,
        [row.clickId, row.sessionId || null, row.provider, row.campaign, row.program, row.roomId, row.page || null, row.category || null, row.country || null, row.language || null, row.trafficSource || null, row.trafficMedium || null, row.trafficCampaign || null, row.device || null, row.destination || null]
      );
    },
    async findClick(clickId) {
      if (!clickId) return null;
      const res = await db.query("SELECT * FROM clicks WHERE click_id = $1 LIMIT 1", [clickId]);
      return res.rows[0] || null;
    },
    async clicks() {
      return (await db.query("SELECT * FROM clicks ORDER BY created_at DESC LIMIT 100")).rows;
    },
    async insertPostback(row) {
      await db.query(
        `INSERT INTO postbacks (id, provider, payload, status, click_id) VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [row.id, row.provider, JSON.stringify(row.payload), row.status, row.clickId || null]
      );
    },
    async findPostbackByTransaction(transactionId) {
      const res = await db.query("SELECT id FROM postbacks WHERE payload->>'transaction_id' = $1 LIMIT 1", [transactionId]);
      return res.rows[0] || null;
    },
    async postbacks() {
      return (await db.query("SELECT * FROM postbacks ORDER BY created_at DESC LIMIT 100")).rows;
    },
    async insertConversion(row) {
      await db.query(
        `INSERT INTO conversions (id, provider, program, campaign, click_id, transaction_id, amount, currency, event_type, state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [row.id, row.provider, row.program || null, row.campaign || null, row.clickId || null, row.transactionId || null, row.amount, row.currency, row.eventType || null, row.state]
      );
    },
    async conversions() {
      return (await db.query("SELECT * FROM conversions ORDER BY created_at DESC LIMIT 100")).rows;
    },
    async saveConfig(row) {
      await db.query(
        `INSERT INTO config_versions (id, key, value, note, author) VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [row.id, row.key, JSON.stringify(row.value), row.note || null, row.author || null]
      );
    },
    async configs(key) {
      return (await db.query("SELECT * FROM config_versions WHERE key = $1 ORDER BY created_at DESC", [key])).rows;
    },
    async audit(row) {
      await db.query(
        `INSERT INTO audit_logs (id, actor, action, detail) VALUES ($1,$2,$3,$4::jsonb)`,
        [row.id, row.actor, row.action, JSON.stringify(row.detail || {})]
      );
    },
    async audits() {
      return (await db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")).rows;
    },
    async setSetting(key, value) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    },
    async setting(key) {
      const res = await db.query("SELECT value FROM system_settings WHERE key = $1", [key]);
      return res.rows[0]?.value ?? null;
    },
    async ensureAdmin(row) {
      const existing = await db.query("SELECT id FROM admins WHERE username = $1", [row.username]);
      if (existing.rows.length) return existing.rows[0];
      await db.query(
        `INSERT INTO admins (id, username, password_hash, role, must_change_password, mfa_secret, mfa_enrolled)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row.id, row.username, row.passwordHash, row.role, row.mustChangePassword, row.mfaSecret || null, Boolean(row.mfaEnrolled)]
      );
      return { id: row.id };
    },
    async adminByUsername(username) {
      const res = await db.query("SELECT * FROM admins WHERE username = $1", [username]);
      return res.rows[0] || null;
    },
    async updateAdmin(id, fields) {
      await db.query(
        `UPDATE admins SET password_hash = COALESCE($2, password_hash), must_change_password = COALESCE($3, must_change_password), mfa_secret = COALESCE($4, mfa_secret), mfa_enrolled = COALESCE($5, mfa_enrolled), updated_at = now() WHERE id = $1`,
        [id, fields.passwordHash || null, fields.mustChangePassword ?? null, fields.mfaSecret || null, fields.mfaEnrolled ?? null]
      );
    },
    async createSession(row) {
      await db.query(
        `INSERT INTO admin_sessions (id, admin_id, expires_at) VALUES ($1,$2,$3)`,
        [row.id, row.adminId, row.expiresAt]
      );
    },
    async session(id) {
      const res = await db.query(
        `SELECT s.*, a.username, a.role, a.must_change_password, a.mfa_enrolled
         FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
         WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
        [id]
      );
      return res.rows[0] || null;
    },
    async revokeSession(id) {
      await db.query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [id]);
    },
    async saveRecoveryCodes(rows) {
      for (const row of rows) {
        await db.query(
          "INSERT INTO mfa_recovery_codes (id, admin_id, code_hash) VALUES ($1,$2,$3)",
          [row.id, row.adminId, row.codeHash]
        );
      }
    },
    async unusedRecovery(adminId, codeHash) {
      const res = await db.query(
        "SELECT id FROM mfa_recovery_codes WHERE admin_id = $1 AND code_hash = $2 AND used_at IS NULL",
        [adminId, codeHash]
      );
      return res.rows[0] || null;
    },
    async consumeRecovery(id) {
      const res = await db.query(
        "UPDATE mfa_recovery_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id",
        [id]
      );
      return res.rows[0] || null;
    },
    async recordLogin(row) {
      await db.query(
        `INSERT INTO login_attempts (id, username, ip, ok) VALUES ($1,$2,$3,$4)`,
        [row.id, row.username, row.ip || null, row.ok]
      );
    },
    async recentFailures(username, sinceIso) {
      const res = await db.query(
        "SELECT count(*)::int AS n FROM login_attempts WHERE username = $1 AND ok = false AND created_at > $2",
        [username, sinceIso]
      );
      return res.rows[0]?.n || 0;
    }
  };
}
