const config = require('../config');
const footballApi = require('../api/footballApi');
const subscriptions = require('../db/subscriptions');
const teamRoles = require('../db/teamRoles');
const matchTracking = require('../db/matchTracking');
const { handleMatchEnd } = require('./matchEndService');
const { eventEmbed, kickoffPingEmbed } = require('../utils/embeds');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

function eventKey(event) {
  return [
    event.time.elapsed,
    event.time.extra || 0,
    event.type,
    event.detail,
    event.player?.id || event.player?.name || '',
    event.team.id,
  ].join('|');
}

/** Channels (with their guild id) that should receive updates for this fixture. */
function channelsForFixture(fixture) {
  const all = subscriptions.all();
  const relevant = all.filter(
    (s) =>
      (s.type === 'league' && s.target_id === fixture.league.id) ||
      (s.type === 'team' && (s.target_id === fixture.teams.home.id || s.target_id === fixture.teams.away.id))
  );
  const seen = new Set();
  return relevant.filter((s) => {
    const key = s.channel_id;
    if (seen.has(key)) return false;
    seen.add(key);
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

async function processEvents(client, fixture, channelRows) {
  const events = await footballApi.getFixtureEvents(fixture.fixture.id);
  for (const event of events) {
    const key = eventKey(event);
    if (matchTracking.hasPostedEvent(fixture.fixture.id, key)) continue;

    await postToChannels(client, channelRows, (row) => {
      const isGoal = (event.type || '').toLowerCase() === 'goal';
      const mention = isGoal ? roleMentionFor(row.guild_id, event.team.id) : null;
      return { content: mention || undefined, embeds: [eventEmbed(fixture, event)] };
    });

    matchTracking.markEventPosted(fixture.fixture.id, key);
  }
}

async function checkFinishedFixtures(client, stillLiveIds) {
  const active = matchTracking.listActiveFixtureIds();
  const noLongerLive = active.filter((id) => !stillLiveIds.has(id));

  for (const fixtureId of noLongerLive) {
    const fixture = await footballApi.getFixtureById(fixtureId);
    if (!fixture) continue;
    if (FINISHED_STATUSES.has(fixture.fixture.status.short)) {
      await handleMatchEnd(client, fixture);
    } else {
      // Transient gap (e.g. between HT and 2H not reported as "live"); keep tracking.
      matchTracking.setLastStatus(fixtureId, fixture.fixture.status.short);
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
      subscribedLeagueIds.has(f.league.id) ||
      subscribedTeamIds.has(f.teams.home.id) ||
      subscribedTeamIds.has(f.teams.away.id)
  );

  for (const fixture of relevant) {
    const fixtureId = fixture.fixture.id;
    const channelRows = channelsForFixture(fixture);
    const previous = matchTracking.getLastStatus(fixtureId);

    if (!previous) {
      await processKickoff(client, fixture, channelRows);
    }

    await processEvents(client, fixture, channelRows);
    matchTracking.setLastStatus(fixtureId, fixture.fixture.status.short);
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
