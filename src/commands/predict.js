const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const predictions = require('../db/predictions');
const { MAJOR_LEAGUE_IDS } = require('../utils/leagues');

const data = new SlashCommandBuilder()
  .setName('predict')
  .setDescription('Predict the scoreline of an upcoming match before kickoff')
  .addStringOption((opt) =>
    opt
      .setName('fixture')
      .setDescription('Start typing a team name to find the upcoming fixture')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((opt) =>
    opt.setName('home_score').setDescription('Predicted home team goals').setRequired(true).setMinValue(0)
  )
  .addIntegerOption((opt) =>
    opt.setName('away_score').setDescription('Predicted away team goals').setRequired(true).setMinValue(0)
  );

async function getUpcomingFixtures() {
  const today = new Date();
  const dates = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const results = await Promise.all(
    dates.map((date) => footballApi.getFixturesByDate({ date }))
  );
  const fixtures = results.flat().filter((f) => MAJOR_LEAGUE_IDS.includes(f.league.id) && f.fixture.status.short === 'NS');
  return fixtures;
}

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const fixtures = await getUpcomingFixtures();

  const matches = fixtures
    .filter((f) => `${f.teams.home.name} ${f.teams.away.name}`.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((f) => ({
      name: `${f.teams.home.name} vs ${f.teams.away.name} — ${new Date(f.fixture.date).toUTCString().slice(0, 22)}`,
      value: String(f.fixture.id),
    }));

  await interaction.respond(matches);
}

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const fixtureId = Number(interaction.options.getString('fixture', true));
  const homeScore = interaction.options.getInteger('home_score', true);
  const awayScore = interaction.options.getInteger('away_score', true);

  const fixtures = await getUpcomingFixtures();
  const fixture = fixtures.find((f) => f.fixture.id === fixtureId);

  if (!fixture) {
    await interaction.editReply(
      'That fixture is no longer available for predictions (it may have already kicked off). Search again.'
    );
    return;
  }

  if (new Date(fixture.fixture.date) <= new Date()) {
    await interaction.editReply('⏱️ Kickoff has already passed — predictions are locked for this match.');
    return;
  }

  predictions.addOrUpdatePrediction({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    fixtureId: fixture.fixture.id,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    predictedHome: homeScore,
    predictedAway: awayScore,
    kickoffUtc: fixture.fixture.date,
  });

  await interaction.editReply(
    `✅ Prediction saved: **${fixture.teams.home.name} ${homeScore} - ${awayScore} ${fixture.teams.away.name}**` +
      '\n\nScoring: 3 pts for an exact score, 1 pt for correctly picking the winner/draw.'
  );
}

module.exports = { data, execute, autocomplete };
