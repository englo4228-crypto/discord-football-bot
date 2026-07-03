const db = require('./database');

const upsertStmt = db.prepare(`
  INSERT INTO team_roles (guild_id, team_id, team_name, role_id)
  VALUES (@guildId, @teamId, @teamName, @roleId)
  ON CONFLICT(guild_id, team_id) DO UPDATE SET role_id = excluded.role_id, team_name = excluded.team_name
`);

const getStmt = db.prepare(`SELECT * FROM team_roles WHERE guild_id = ? AND team_id = ?`);
const listForGuildStmt = db.prepare(`SELECT * FROM team_roles WHERE guild_id = ?`);

function setTeamRole({ guildId, teamId, teamName, roleId }) {
  return upsertStmt.run({ guildId, teamId, teamName, roleId });
}

function getTeamRole(guildId, teamId) {
  return getStmt.get(guildId, teamId);
}

function listForGuild(guildId) {
  return listForGuildStmt.all(guildId);
}

module.exports = { setTeamRole, getTeamRole, listForGuild };
