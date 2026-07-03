const db = require('./database');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO subscriptions (guild_id, channel_id, type, target_id, target_name)
  VALUES (@guildId, @channelId, @type, @targetId, @targetName)
`);

const deleteStmt = db.prepare(`
  DELETE FROM subscriptions WHERE channel_id = ? AND type = ? AND target_id = ?
`);

const listForChannelStmt = db.prepare(`
  SELECT * FROM subscriptions WHERE channel_id = ? ORDER BY created_at
`);

const listForGuildStmt = db.prepare(`
  SELECT * FROM subscriptions WHERE guild_id = ? ORDER BY created_at
`);

const allStmt = db.prepare(`SELECT * FROM subscriptions`);

function addSubscription({ guildId, channelId, type, targetId, targetName }) {
  return insertStmt.run({ guildId, channelId, type, targetId: String(targetId), targetName });
}

function removeSubscription({ channelId, type, targetId }) {
  return deleteStmt.run(channelId, type, String(targetId));
}

function listForChannel(channelId) {
  return listForChannelStmt.all(channelId);
}

function listForGuild(guildId) {
  return listForGuildStmt.all(guildId);
}

function all() {
  return allStmt.all();
}

module.exports = { addSubscription, removeSubscription, listForChannel, listForGuild, all };
