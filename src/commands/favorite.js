const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const footballApi = require('../api/footballApi');
const teamRoles = require('../db/teamRoles');

const data = new SlashCommandBuilder()
  .setName('favorite')
  .setDescription('Assign yourself a fan role for your favorite team (creates the role if needed)')
  .addStringOption((opt) =>
    opt.setName('team').setDescription('Team name, e.g. "Arsenal"').setRequired(true)
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const teamName = interaction.options.getString('team', true);
  const teams = await footballApi.searchTeam(teamName);
  if (teams.length === 0) {
    await interaction.editReply(`Couldn't find a team matching "${teamName}".`);
    return;
  }

  const team = teams[0].team;
  let roleRecord = teamRoles.getTeamRole(interaction.guildId, team.id);
  let role = roleRecord ? interaction.guild.roles.cache.get(roleRecord.role_id) : null;

  if (!role) {
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply(
        "I need the **Manage Roles** permission to create fan roles. Ask an admin to grant it, or create a role named after your team manually."
      );
      return;
    }
    role = await interaction.guild.roles.create({
      name: `${team.name} Fan`,
      mentionable: true,
      reason: `Fan role for ${team.name}, requested via /favorite`,
    });
    teamRoles.setTeamRole({
      guildId: interaction.guildId,
      teamId: team.id,
      teamName: team.name,
      roleId: role.id,
    });
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await member.roles.add(role);

  await interaction.editReply(`✅ You now have the **${role.name}** role. You'll be pinged for kickoffs and goals.`);
}

module.exports = { data, execute };
