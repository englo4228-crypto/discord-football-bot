const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { standingsEmbed } = require('../utils/embeds');
const { findLeagueByName, MAJOR_LEAGUES } = require('../utils/leagues');

const data = new SlashCommandBuilder()
  .setName('table')
  .setDescription('Show the current league standings')
  .addStringOption((opt) =>
    opt
      .setName('league')
      .setDescription('League name')
      .setRequired(true)
      .addChoices(...Object.keys(MAJOR_LEAGUES).map((name) => ({ name, value: name })))
  );

async function execute(interaction) {
  await interaction.deferReply();

  const leagueName = interaction.options.getString('league', true);
  const league = findLeagueByName(leagueName);
  if (!league) {
    await interaction.editReply(`Couldn't find a tracked league matching "${leagueName}".`);
    return;
  }

  const standings = await footballApi.getStandings({ leagueId: league.id });
  await interaction.editReply({ embeds: [standingsEmbed(league.name, standings)] });
}

module.exports = { data, execute };
