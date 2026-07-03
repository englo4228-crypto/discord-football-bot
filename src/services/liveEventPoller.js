const config = require('../config');
const footballApi = require('../api/footballApi');
const subscriptions = require('../db/subscriptions');
const teamRoles = require('../db/teamRoles');
const matchTracking = require('../db/matchTracking');
const { handleMatchEnd } = require('./matchEndService');
const { goalEmbed, kickoffPingEmbed } = require('../utils/embeds');

/** Channels (with their guild id) that should receive updates for this fixture. */
function channelsForFixture(fixture) {
  const all = subscriptions.all();
  const relevant = all.filter(
    (s) =>
      (s.type === 'league' && s.target_id === String(fixture.league.id)) ||
      (s.type === 'team' &&
        (s.target_id === String(fixture.teams.home.id) || s.target_id === String(fixture.teams.away.id)))
  );
  const seen = new Set();
  return relevant.filter((s) => {
    if (seen.has(s.channel_id)) return false;
    seen.add(s.channel_id);
    return true;
  });
}

function roleMentionFor(guildId, teamId) {
  const role = teamRoles.getTeamRole(guildId, teamId);
  return role ? `<@&${role.role_id}>` : null;
}

async function postToChannels(client, channelRows, buildContent) {
  await Promise.all(
    channelRows.map(async (row) => {
      const channel = client.channels.cache.get(row.channel_id);
      if (!channel || !channel.isTextBased()) return;
      try {
        await channel.send(buildContent(row));
      } catch (err) {
        console.warn(`[liveEventPoller] Failed to post to channel ${row.channel_id}:`, err.message);
      }
    })
  );
}

async function processKickoff(client, fixture, channelRows) {
  await postToChannels(client, channelRows, (row) => {
    const mentions = [roleMentionFor(row.guild_id, fixture.teams.home.id), roleMentionFor(row.guild_id, fixture.teams.away.id)]
      .filter(Boolean)
      .join(' ');
    return { content: mentions || undefined, embeds: [kickoffPingEmbed(fixture)] };
  });
}

/**
 * Posts a goal notification for each newly-scored goal since the last poll.
 * football-data.org's free tier has no minute-by-minute event feed, so goals
 * are detected purely by comparing the live scoreline to what we saw last
 * poll — there's no scorer/assist name, and cards/subs/VAR can't be detected
 * at all from score alone.
 */
async function processScoreChange(client, fixture, channelRows, previous) {
  if (!previous) return;

  const homeDelta = fixture.goals.home - previous.last_home_goals;
  const awayDelta = fixture.goals.away - previous.last_away_goals;

  for (let i = 0; i < homeDelta; i += 1) {
    await postToChannels(client, channelRows, (row) => ({
      content: roleMentionFor(row.guild_id, fixture.teams.home.id) || undefined,
      embeds: [goalEmbed(fixture, fixture.teams.home.name)],
    }));
  }

  for (let i = 0; i < awayDelta; i += 1) {
    await postToChannels(client, channelRows, (row) => ({
      content: roleMentionFor(row.guild_id, fixture.teams.away.id) || undefined,
      embeds: [goalEmbed(fixture, fixture.teams.away.name)],
    }));
  }
}

async function checkFinishedFixtures(client, stillLiveIds) {
  const active = matchTracking.listActiveFixtureIds();
  const noLongerLive = active.filter((id) => !stillLiveIds.has(id));

  for (const fixtureId of noLongerLive) {
    const fixture = await footballApi.getFixtureById(fixtureId);
    if (!fixture) continue;
    if (footballApi.STOPPED_SHORT_STATUSES.has(fixture.fixture.status.short)) {
      await handleMatchEnd(client, fixture);
    } else {
      // Transient gap (e.g. between HT and 2H not reported as "live"); keep tracking.
      matchTracking.updateFixtureState(fixtureId, fixture.fixture.status.short, fixture.goals.home, fixture.goals.away);
    }
  }
}

async function poll(client) {
  const subs = subscriptions.all();
  if (subs.length === 0) return;

  const subscribedLeagueIds = new Set(subs.filter((s) => s.type === 'league').map((s) => s.target_id));
  const subscribedTeamIds = new Set(subs.filter((s) => s.type === 'team').map((s) => s.target_id));

  const liveFixtures = await footballApi.getLiveFixtures([]);
  const relevant = liveFixtures.filter(
    (f) =>
      subscribedLeagueIds.has(String(f.league.id)) ||
      subscribedTeamIds.has(String(f.teams.home.id)) ||
      subscribedTeamIds.has(String(f.teams.away.id))
  );

  for (const fixture of relevant) {
    const fixtureId = fixture.fixture.id;
    const channelRows = channelsForFixture(fixture);
    const previous = matchTracking.getLastStatus(fixtureId);

    if (!previous) {
      await processKickoff(client, fixture, channelRows);
    } else {
      await processScoreChange(client, fixture, channelRows, previous);
    }

    matchTracking.updateFixtureState(fixtureId, fixture.fixture.status.short, fixture.goals.home, fixture.goals.away);
  }

  await checkFinishedFixtures(client, new Set(relevant.map((f) => f.fixture.id)));
}

function startLivePoller(client) {
  const intervalMs = config.livePollIntervalSeconds * 1000;
  console.log(`[liveEventPoller] Polling every ${config.livePollIntervalSeconds}s`);

  setInterval(() => {
    poll(client).catch((err) => console.error('[liveEventPoller] Poll failed:', err));
  }, intervalMs);
}

module.exports = { startLivePoller };
