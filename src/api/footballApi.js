const axios = require('axios');
const config = require('../config');
const { cached } = require('../utils/cache');
const { RateLimiter } = require('../utils/rateLimiter');
const { MAJOR_LEAGUE_IDS } = require('../utils/leagues');

const client = axios.create({
  baseURL: config.footballDataBaseUrl,
  headers: { 'X-Auth-Token': config.footballDataApiKey },
  timeout: 15000,
});

// football-data.org's free tier is hard-capped at 10 requests/minute across
// the whole API key, so every call funnels through one limiter regardless of
// which guild or command triggered it.
const limiter = new RateLimiter(10, 60_000);

async function request(endpoint, params = {}, { retryOn429 = true } = {}) {
  try {
    const { data } = await limiter.schedule(() => client.get(endpoint, { params }));
    return data;
  } catch (err) {
    if (err.response?.status === 429 && retryOn429) {
      const retryAfterSeconds = Number(err.response.headers['retry-after']) || 15;
      console.warn(`[footballApi] 429 from ${endpoint}, retrying in ${retryAfterSeconds}s`);
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return request(endpoint, params, { retryOn429: false });
    }
    console.error(`[footballApi] Request failed: ${endpoint}`, err.response?.data || err.message);
    throw new Error(`Football-Data.org request to ${endpoint} failed`);
  }
}

/** Maps a football-data.org match status to the internal short-status vocabulary used by embeds. */
function mapStatus(status) {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'NS';
    case 'IN_PLAY':
      return '1H';
    case 'PAUSED':
      return 'HT';
    case 'FINISHED':
      return 'FT';
    case 'SUSPENDED':
      return 'SUSP';
    case 'POSTPONED':
      return 'PST';
    case 'CANCELLED':
      return 'CANC';
    case 'AWARDED':
      return 'AWD';
    default:
      return status;
  }
}

const FINISHED_SHORT_STATUSES = new Set(['FT', 'AWD']);
const STOPPED_SHORT_STATUSES = new Set(['FT', 'AWD', 'SUSP', 'PST', 'CANC']);

/** Normalizes a football-data.org match object into the shape the rest of the bot expects. */
function normalizeMatch(match) {
  const round = match.stage
    ? `${match.stage.replaceAll('_', ' ')}${match.matchday ? ` - Matchday ${match.matchday}` : ''}`
    : match.matchday
      ? `Matchday ${match.matchday}`
      : '';

  return {
    fixture: {
      id: match.id,
      date: match.utcDate,
      status: {
        short: mapStatus(match.status),
        long: match.status,
        elapsed: typeof match.minute === 'number' ? match.minute : null,
      },
      referee: match.referees?.[0]?.name || null,
    },
    league: {
      id: match.competition?.code,
      name: match.competition?.name,
      country: match.area?.name,
      logo: match.competition?.emblem,
      season: match.season?.id,
      round,
    },
    teams: {
      home: {
        id: match.homeTeam?.id,
        name: match.homeTeam?.shortName || match.homeTeam?.name || 'TBD',
        logo: match.homeTeam?.crest,
      },
      away: {
        id: match.awayTeam?.id,
        name: match.awayTeam?.shortName || match.awayTeam?.name || 'TBD',
        logo: match.awayTeam?.crest,
      },
    },
    goals: {
      home: match.score?.fullTime?.home ?? 0,
      away: match.score?.fullTime?.away ?? 0,
    },
    score: {
      halftime: match.score?.halfTime || { home: null, away: null },
      fulltime: match.score?.fullTime || { home: null, away: null },
    },
  };
}

/** All matches currently in play, optionally restricted to a set of competition codes. */
async function getLiveFixtures(competitionCodes = MAJOR_LEAGUE_IDS) {
  const params = { status: 'LIVE' };
  if (competitionCodes && competitionCodes.length > 0) {
    params.competitions = competitionCodes.join(',');
  }
  const data = await cached(`live-${(competitionCodes || []).join(',')}`, 30_000, () =>
    request('/matches', params)
  );
  return (data.matches || []).map(normalizeMatch);
}

async function getFixturesByDate({ date, leagueId }) {
  const params = { dateFrom: date, dateTo: date };
  if (leagueId) params.competitions = leagueId;
  const key = `fixtures-date-${date}-${leagueId || 'all'}`;
  const data = await cached(key, 5 * 60_000, () => request('/matches', params));
  return (data.matches || []).map(normalizeMatch);
}

async function getFixturesByTeam({ teamId, status = 'SCHEDULED', limit = 10 }) {
  const key = `fixtures-team-${teamId}-${status}-${limit}`;
  const data = await cached(key, 5 * 60_000, () =>
    request(`/teams/${teamId}/matches`, { status, limit })
  );
  return (data.matches || []).map(normalizeMatch);
}

/** Full match detail — used by the poller to read the live score for diffing. */
async function getFixtureById(fixtureId) {
  const key = `fixture-${fixtureId}`;
  const data = await cached(key, 20_000, () => request(`/matches/${fixtureId}`));
  return data ? normalizeMatch(data) : null;
}

async function getStandings({ leagueId }) {
  const key = `standings-${leagueId}`;
  const data = await cached(key, 15 * 60_000, () => request(`/competitions/${leagueId}/standings`));
  const total = (data.standings || []).find((s) => s.type === 'TOTAL');
  if (!total) return [];
  return total.table.map((row) => ({
    rank: row.position,
    team: { name: row.team.name },
    all: { played: row.playedGames, win: row.won, draw: row.draw, lose: row.lost },
    goalsDiff: row.goalDifference,
    points: row.points,
  }));
}

// football-data.org has no team-name search endpoint, so we build one by
// caching each tracked competition's squad list and searching across them.
async function getCompetitionTeams(competitionCode) {
  const key = `competition-teams-${competitionCode}`;
  const data = await cached(key, 24 * 60 * 60_000, () => request(`/competitions/${competitionCode}/teams`));
  return data.teams || [];
}

/** Best-effort warm-up so the first `/subscribe` or `/favorite` in a fresh process isn't slow. */
async function warmTeamCache() {
  for (const code of MAJOR_LEAGUE_IDS) {
    try {
      await getCompetitionTeams(code);
    } catch (err) {
      console.warn(`[footballApi] Failed to warm team cache for ${code}:`, err.message);
    }
  }
}

async function searchTeam(name) {
  const needle = name.trim().toLowerCase();
  const allTeams = (await Promise.all(MAJOR_LEAGUE_IDS.map((code) => getCompetitionTeams(code)))).flat();

  const seen = new Set();
  const matches = [];
  for (const team of allTeams) {
    if (seen.has(team.id)) continue;
    const haystack = `${team.name} ${team.shortName || ''} ${team.tla || ''}`.toLowerCase();
    if (haystack.includes(needle)) {
      seen.add(team.id);
      matches.push({ team: { id: team.id, name: team.shortName || team.name, logo: team.crest } });
    }
  }
  return matches;
}

/** Recent finished results for a team, used to build a W-D-L form strip. */
async function getTeamRecentForm({ teamId, limit = 5 }) {
  const key = `team-form-${teamId}-${limit}`;
  const data = await cached(key, 15 * 60_000, () =>
    request(`/teams/${teamId}/matches`, { status: 'FINISHED', limit })
  );
  const matches = (data.matches || []).slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  const form = matches
    .map((m) => {
      const isHome = m.homeTeam.id === teamId;
      const gf = isHome ? m.score.fullTime.home : m.score.fullTime.away;
      const ga = isHome ? m.score.fullTime.away : m.score.fullTime.home;
      goalsFor += gf ?? 0;
      goalsAgainst += ga ?? 0;
      if (gf > ga) {
        wins += 1;
        return 'W';
      }
      if (gf < ga) {
        losses += 1;
        return 'L';
      }
      draws += 1;
      return 'D';
    })
    .join('');

  return { form, played: matches.length, wins, draws, losses, goalsFor, goalsAgainst };
}

async function getTopScorers({ leagueId, limit = 10 }) {
  const key = `scorers-${leagueId}-${limit}`;
  const data = await cached(key, 30 * 60_000, () =>
    request(`/competitions/${leagueId}/scorers`, { limit })
  );
  return data.scorers || [];
}

module.exports = {
  getLiveFixtures,
  getFixtureById,
  getFixturesByDate,
  getFixturesByTeam,
  getStandings,
  searchTeam,
  warmTeamCache,
  getTeamRecentForm,
  getTopScorers,
  FINISHED_SHORT_STATUSES,
  STOPPED_SHORT_STATUSES,
};
