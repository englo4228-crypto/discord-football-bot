const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { formEmbed } = require('../utils/embeds');
const { MAJOR_LEAGUE_IDS } = require('../utils/leagues');

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

  const leagues = await footballApi.getTeamLeagues(team.id);
  const primaryLeague = leagues.find((l) => MAJOR_LEAGUE_IDS.includes(l.league.id)) || leagues[0];
  if (!primaryLeague) {
    await interaction.editReply(`No current league data found for **${team.name}**.`);
    return;
  }

  const stats = await footballApi.getTeamForm({ teamId: team.id, leagueId: primaryLeague.league.id });
  await interaction.editReply({ embeds: [formEmbed(team.name, stats)] });
}

module.exports = { data, execute };
