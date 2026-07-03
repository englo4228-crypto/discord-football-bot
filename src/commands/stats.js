const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { scoreLine, statusLabel, COLORS } = require('../utils/embeds');

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show live in-game statistics for a currently live match')
  .addStringOption((opt) =>
    opt.setName('fixture').setDescription('Start typing a team name').setRequired(true).setAutocomplete(true)
  );

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const fixtures = await footballApi.getLiveFixtures();
  const matches = fixtures
    .filter((f) => `${f.teams.home.name} ${f.teams.away.name}`.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((f) => ({ name: `${f.teams.home.name} vs ${f.teams.away.name}`, value: String(f.fixture.id) }));
  await interaction.respond(matches);
}

function statValue(stats, type) {
  return stats.find((s) => s.type === type)?.value ?? 'N/A';
}

async function execute(interaction) {
  await interaction.deferReply();

  const fixtureId = Number(interaction.options.getString('fixture', true));
  const liveFixtures = await footballApi.getLiveFixtures();
  const fixture = liveFixtures.find((f) => f.fixture.id === fixtureId);

  if (!fixture) {
    await interaction.editReply('That match is no longer live. Use `/live` to see current matches.');
    return;
  }

  const statistics = await footballApi.getFixtureStatistics(fixtureId);
  if (statistics.length < 2) {
    await interaction.editReply('No statistics are available for this match yet.');
    return;
  }

  const [home, away] = statistics;
  const embed = new EmbedBuilder()
    .setTitle(`📊 Live Stats — ${statusLabel(fixture.fixture.status)}`)
    .setDescription(scoreLine(fixture))
    .setColor(COLORS.live)
    .addFields(
      {
        name: 'Possession',
        value: `${home.team.name}: ${statValue(home.statistics, 'Ball Possession')} — ${away.team.name}: ${statValue(away.statistics, 'Ball Possession')}`,
      },
      {
        name: 'Shots on Target',
        value: `${statValue(home.statistics, 'Shots on Goal')} — ${statValue(away.statistics, 'Shots on Goal')}`,
      },
      {
        name: 'Expected Goals (xG)',
        value: `${statValue(home.statistics, 'expected_goals')} — ${statValue(away.statistics, 'expected_goals')}`,
      },
      {
        name: 'Corners',
        value: `${statValue(home.statistics, 'Corner Kicks')} — ${statValue(away.statistics, 'Corner Kicks')}`,
      },
      {
        name: 'Fouls',
        value: `${statValue(home.statistics, 'Fouls')} — ${statValue(away.statistics, 'Fouls')}`,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute, autocomplete };
