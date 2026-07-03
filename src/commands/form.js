const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { formEmbed } = require('../utils/embeds');

const data = new SlashCommandBuilder()
  .setName('form')
  .setDescription("Show a team's recent results (last 5 matches)")
  .addStringOption((opt) => opt.setName('team').setDescription('Team name').setRequired(true));

async function execute(interaction) {
  await interaction.deferReply();

  const name = interaction.options.getString('team', true);
  const teams = await footballApi.searchTeam(name);
  if (teams.length === 0) {
    await interaction.editReply(`Couldn't find a team matching "${name}".`);
    return;
  }
  const team = teams[0].team;

  const stats = await footballApi.getTeamRecentForm({ teamId: team.id, limit: 5 });
  if (stats.played === 0) {
    await interaction.editReply(`No recent finished matches found for **${team.name}**.`);
    return;
  }

  await interaction.editReply({ embeds: [formEmbed(team.name, stats)] });
}

module.exports = { data, execute };
