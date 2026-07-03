const footballApi = require('../api/footballApi');
const highlights = require('../api/highlights');
const predictions = require('../db/predictions');
const matchTracking = require('../db/matchTracking');
const subscriptions = require('../db/subscriptions');
const settingsDb = require('../db/settings');
const { fullTimeEmbed } = require('../utils/embeds');

const EXACT_SCORE_POINTS = 3;
const CORRECT_RESULT_POINTS = 1;
const FIRST_SCORER_BONUS = 1;

function actualResult(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'home';
  if (awayGoals > homeGoals) return 'away';
  return 'draw';
}

function predictedResult(predictedHome, predictedAway) {
  if (predictedHome > predictedAway) return 'home';
  if (predictedAway > predictedHome) return 'away';
  return 'draw';
}

async function resolveActualFirstScorer(fixtureId) {
  const events = await footballApi.getFixtureEvents(fixtureId);
  const firstGoal = events.find((e) => e.type === 'Goal');
  return firstGoal?.player?.name || null;
}

async function scorePredictions(fixture) {
  const { home: homeGoals, away: awayGoals } = fixture.goals;
  const pending = predictions.getUnresolvedForFixture(fixture.fixture.id);
  if (pending.length === 0) return;

  const actualFirstScorer = await resolveActualFirstScorer(fixture.fixture.id);
  const result = actualResult(homeGoals, awayGoals);

  for (const prediction of pending) {
    let points = 0;
    const exact = prediction.predicted_home === homeGoals && prediction.predicted_away === awayGoals;
    if (exact) {
      points += EXACT_SCORE_POINTS;
    } else if (predictedResult(prediction.predicted_home, prediction.predicted_away) === result) {
      points += CORRECT_RESULT_POINTS;
    }

    if (
      prediction.first_scorer &&
      actualFirstScorer &&
      actualFirstScorer.toLowerCase().includes(prediction.first_scorer.toLowerCase())
    ) {
      points += FIRST_SCORER_BONUS;
    }

    predictions.resolvePrediction(prediction.id, points);
    predictions.bumpUserScore({
      guildId: prediction.guild_id,
      userId: prediction.user_id,
      points,
      correct: points > 0,
    });
  }
}

async function syncPunditRole(client, guildId) {
  const guildSettings = settingsDb.getGuildSettings(guildId);
  if (!guildSettings?.pundit_role_id) return;

  const topScorer = predictions.getTopScorer(guildId);
  if (!topScorer) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const role = await guild.roles.fetch(guildSettings.pundit_role_id);
    if (!role) return;

    for (const [, member] of role.members) {
      if (member.id !== topScorer.user_id) await member.roles.remove(role);
    }
    const newHolder = await guild.members.fetch(topScorer.user_id);
    if (!newHolder.roles.cache.has(role.id)) await newHolder.roles.add(role);
  } catch (err) {
    console.warn(`[matchEndService] Failed to sync pundit role for guild ${guildId}:`, err.message);
  }
}

function findSubscribedChannels(client, fixture) {
  const all = subscriptions.all();
  const relevant = all.filter(
    (s) =>
      (s.type === 'league' && s.target_id === fixture.league.id) ||
      (s.type === 'team' && (s.target_id === fixture.teams.home.id || s.target_id === fixture.teams.away.id))
  );
  const uniqueChannelIds = [...new Set(relevant.map((s) => s.channel_id))];
  return uniqueChannelIds
    .map((id) => client.channels.cache.get(id))
    .filter((c) => c && c.isTextBased());
}

async function handleMatchEnd(client, fixture) {
  const fixtureId = fixture.fixture.id;
  if (matchTracking.getLastStatus(fixtureId)?.resolved) return;

  await scorePredictions(fixture);

  const guildIds = [...new Set(subscriptions.all().map((s) => s.guild_id))];
  await Promise.all(guildIds.map((guildId) => syncPunditRole(client, guildId)));

  const channels = findSubscribedChannels(client, fixture);
  if (channels.length > 0) {
    const embed = fullTimeEmbed(fixture);
    const highlight = await highlights.findHighlightForFixture(fixture.teams.home.name, fixture.teams.away.name);
    if (highlight) {
      embed.addFields({ name: '🎥 Highlights', value: `[${highlight.title}](${highlight.url})` });
    }
    await Promise.all(channels.map((channel) => channel.send({ embeds: [embed] }).catch(() => null)));
  }

  matchTracking.markFixtureResolved(fixtureId);
}

module.exports = { handleMatchEnd };
