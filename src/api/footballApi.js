const axios = require('axios');
const config = require('../config');
const { cached } = require('../utils/cache');
const { MAJOR_LEAGUE_IDS } = require('../utils/leagues');

const client = axios.create({
  baseURL: `https://${config.footballApiHost}`,
  headers: {
    'x-apisports-key': config.footballApiKey,
  },
  timeout: 10000,
});

async function request(endpoint, params = {}) {
  try {
    const { data } = await client.get(endpoint, { params });
    if (data.errors && Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors || {}).length) {
      console.error(`[footballApi] API error on ${endpoint}:`, data.errors);
    }
    return data.response || [];
  } catch (err) {
    console.error(`[footballApi] Request failed: ${endpoint}`, err.response?.data || err.message);
    throw new Error(`Football API request to ${endpoint} failed`);
  }
}

/** All fixtures currently in play. Optionally filtered to a set of league IDs. */
async function getLiveFixtures(leagueIds = MAJOR_LEAGUE_IDS) {
  const fixtures = await cached('live-fixtures', 20_000, () => request('/fixtures', { live: 'all' }));
  if (!leagueIds || leagueIds.length === 0) return fixtures;
  const idSet = new Set(leagueIds);
  return fixtures.filter((f) => idSet.has(f.league.id));
}

async function getFixturesByDate({ date, leagueId, season = config.footballSeason }) {
  const params = { date };
  if (leagueId) {
    params.league = leagueId;
    params.season = season;
  }
  const key = `fixtures-date-${date}-${leagueId || 'all'}`;
  return cached(key, 5 * 60_000, () => request('/fixtures', params));
}

async function getFixtureById(fixtureId) {
  const response = await cached(`fixture-${fixtureId}`, 15_000, () =>
    request('/fixtures', { id: fixtureId })
  );
  return response[0] || null;
}

async function getFixturesByTeam({ teamId, next = 10, season = config.footballSeason }) {
  const key = `fixtures-team-${teamId}-${next}`;
  return cached(key, 5 * 60_000, () =>
    request('/fixtures', { team: teamId, next, season })
  );
}

async function getStandings({ leagueId, season = config.footballSeason }) {
  const key = `standings-${leagueId}-${season}`;
  const response = await cached(key, 15 * 60_000, () =>
    request('/standings', { league: leagueId, season })
  );
  return response[0]?.league?.standings?.[0] || [];
}

async function getFixtureEvents(fixtureId) {
  // Short TTL: this is polled during live matches, so we want fresh data.
  return cached(`events-${fixtureId}`, 15_000, () => request('/fixtures/events', { fixture: fixtureId }));
}

async function getFixtureStatistics(fixtureId) {
  return cached(`stats-${fixtureId}`, 30_000, () =>
    request('/fixtures/statistics', { fixture: fixtureId })
  );
}

async function searchTeam(name) {
  const key = `team-search-${name.toLowerCase()}`;
  return cached(key, 60 * 60_000, () => request('/teams', { search: name }));
}

/** Leagues/cups a team is currently competing in (used to resolve a team's primary league). */
async function getTeamLeagues(teamId) {
  return cached(`team-leagues-${teamId}`, 60 * 60_000, () =>
    request('/leagues', { team: teamId, current: 'true' })
  );
}

async function searchLeague(name) {
  const key = `league-search-${name.toLowerCase()}`;
  return cached(key, 60 * 60_000, () => request('/leagues', { search: name }));
}

async function searchPlayer(name, teamId) {
  const params = { search: name };
  if (teamId) params.team = teamId;
  return cached(`player-search-${name.toLowerCase()}-${teamId || ''}`, 60 * 60_000, () =>
    request('/players', params)
  );
}

async function getPlayerStats(playerId, season = config.footballSeason) {
  const response = await cached(`player-stats-${playerId}-${season}`, 30 * 60_000, () =>
    request('/players', { id: playerId, season })
  );
  return response[0] || null;
}

async function getTeamForm({ teamId, leagueId, season = config.footballSeason }) {
  const key = `team-stats-${teamId}-${leagueId}-${season}`;
  const stats = await cached(key, 15 * 60_000, () =>
    request('/teams/statistics', { team: teamId, league: leagueId, season })
  );
  return stats;
}

module.exports = {
  getLiveFixtures,
  getFixtureById,
  getFixturesByDate,
  getFixturesByTeam,
  getStandings,
  getFixtureEvents,
  getFixtureStatistics,
  searchTeam,
  getTeamLeagues,
  searchLeague,
  searchPlayer,
  getPlayerStats,
  getTeamForm,
};
