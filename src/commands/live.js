const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { liveMatchesEmbed } = require('../utils/embeds');
const { findLeagueByName } = require('../utils/leagues');

const data = new SlashCommandBuilder()
  .setName('live')
  .setDescription('Show all matches currently being played across major leagues')
  .addStringOption((opt) =>
    opt.setName('league').setDescription('Filter to a specific league, e.g. "Premier League"').setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const leagueName = interaction.options.getString('league');
  let leagueIds;
  if (leagueName) {
    const league = findLeagueByName(leagueName);
    if (!league) {
      await interaction.editReply(`Couldn't find a tracked league matching "${leagueName}".`);
      return;
    }
    leagueIds = [league.id];
  }

  const fixtures = await footballApi.getLiveFixtures(leagueIds);
  await interaction.editReply({ embeds: [liveMatchesEmbed(fixtures)] });
}

module.exports = { data, execute };
