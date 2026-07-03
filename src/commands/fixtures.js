const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { fixturesListEmbed } = require('../utils/embeds');
const { findLeagueByName } = require('../utils/leagues');
const { resolveTimezone } = require('../utils/time');

const data = new SlashCommandBuilder()
  .setName('fixtures')
  .setDescription('Search upcoming matches by date, league or team')
  .addStringOption((opt) =>
    opt.setName('date').setDescription('Date in YYYY-MM-DD format (default: today)').setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('league').setDescription('League name, e.g. "La Liga"').setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('team').setDescription('Team name, e.g. "Arsenal"').setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const date = interaction.options.getString('date') || new Date().toISOString().slice(0, 10);
  const leagueName = interaction.options.getString('league');
  const teamName = interaction.options.getString('team');

  let leagueId;
  if (leagueName) {
    const league = findLeagueByName(leagueName);
    if (!league) {
      await interaction.editReply(`Couldn't find a tracked league matching "${leagueName}".`);
      return;
    }
    leagueId = league.id;
  }

  let fixtures;
  if (teamName) {
    const teams = await footballApi.searchTeam(teamName);
    if (teams.length === 0) {
      await interaction.editReply(`Couldn't find a team matching "${teamName}".`);
      return;
    }
    fixtures = await footballApi.getFixturesByTeam({ teamId: teams[0].team.id });
  } else {
    fixtures = await footballApi.getFixturesByDate({ date, leagueId });
  }

  const timezone = resolveTimezone({ userId: interaction.user.id, guildId: interaction.guildId });
  await interaction.editReply({
    embeds: [fixturesListEmbed(fixtures, { leagueName, timezone })],
  });
}

module.exports = { data, execute };
