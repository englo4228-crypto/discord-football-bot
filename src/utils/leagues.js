// football-data.org v4 competition codes. This is exactly the set of
// competitions covered by the free tier (10 req/min, no daily cap).
// https://www.football-data.org/documentation/quickstart

const MAJOR_LEAGUES = {
  'Premier League': 'PL',
  'Championship': 'ELC',
  'La Liga': 'PD',
  'Serie A': 'SA',
  'Bundesliga': 'BL1',
  'Ligue 1': 'FL1',
  'Eredivisie': 'DED',
  'Primeira Liga': 'PPL',
  'Champions League': 'CL',
  'European Championship': 'EC',
  'World Cup': 'WC',
  'Brasileirão': 'BSA',
};

const MAJOR_LEAGUE_IDS = Object.values(MAJOR_LEAGUES);

function findLeagueByName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();

  const codeMatch = Object.entries(MAJOR_LEAGUES).find(([, code]) => code.toLowerCase() === normalized);
  if (codeMatch) return { name: codeMatch[0], id: codeMatch[1] };

  const exact = Object.entries(MAJOR_LEAGUES).find(([leagueName]) => leagueName.toLowerCase() === normalized);
  if (exact) return { name: exact[0], id: exact[1] };

  const partial = Object.entries(MAJOR_LEAGUES).find(([leagueName]) =>
    leagueName.toLowerCase().includes(normalized)
  );
  return partial ? { name: partial[0], id: partial[1] } : null;
}

module.exports = { MAJOR_LEAGUES, MAJOR_LEAGUE_IDS, findLeagueByName };
