const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { findLeagueByName, MAJOR_LEAGUES } = require('../utils/leagues');
const { COLORS } = require('../utils/embeds');

const data = new SlashCommandBuilder()
  .setName('topscorers')
  .setDescription("Show a league's top goalscorers this season")
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

  const scorers = await footballApi.getTopScorers({ leagueId: league.id, limit: 10 });
  const embed = new EmbedBuilder()
    .setTitle(`⚽ ${league.name} — Top Scorers`)
    .setColor(COLORS.goal)
    .setTimestamp();

  if (scorers.length === 0) {
    embed.setDescription('No scorer data available yet for this competition.');
  } else {
    const lines = scorers.map((s, i) => {
      const assists = s.assists != null ? `, ${s.assists} assists` : '';
      return `**${i + 1}.** ${s.player.name} (${s.team.name}) — **${s.goals}** goals${assists}`;
    });
    embed.setDescription(lines.join('\n'));
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
