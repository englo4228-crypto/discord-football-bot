const db = require('./database');

const getUserTzStmt = db.prepare(`SELECT timezone FROM user_timezones WHERE user_id = ?`);
const setUserTzStmt = db.prepare(`
  INSERT INTO user_timezones (user_id, timezone) VALUES (?, ?)
  ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone
`);

const getGuildSettingsStmt = db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`);
const upsertGuildTzStmt = db.prepare(`
  INSERT INTO guild_settings (guild_id, timezone) VALUES (?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET timezone = excluded.timezone
`);
const upsertPunditRoleStmt = db.prepare(`
  INSERT INTO guild_settings (guild_id, pundit_role_id) VALUES (?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET pundit_role_id = excluded.pundit_role_id
`);

function setUserTimezone(userId, timezone) {
  return setUserTzStmt.run(userId, timezone);
}

function getUserTimezone(userId) {
  const row = getUserTzStmt.get(userId);
  return row ? row.timezone : null;
}

function setGuildTimezone(guildId, timezone) {
  return upsertGuildTzStmt.run(guildId, timezone);
}

function setPunditRole(guildId, roleId) {
  return upsertPunditRoleStmt.run(guildId, roleId);
}

function getGuildSettings(guildId) {
  return getGuildSettingsStmt.get(guildId) || null;
}

module.exports = {
  setUserTimezone,
  getUserTimezone,
  setGuildTimezone,
  setPunditRole,
  getGuildSettings,
};
