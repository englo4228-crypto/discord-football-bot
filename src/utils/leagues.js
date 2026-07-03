// API-Football (api-sports.io) league IDs for commonly followed competitions.
// https://www.api-football.com/documentation-v3#tag/Leagues

const MAJOR_LEAGUES = {
  'Premier League': 39,
  'Championship': 40,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Eredivisie': 88,
  'Primeira Liga': 94,
  'MLS': 253,
  'Champions League': 2,
  'Europa League': 3,
  'Conference League': 848,
  'World Cup': 1,
  'Euro Championship': 4,
};

const MAJOR_LEAGUE_IDS = Object.values(MAJOR_LEAGUES);

function findLeagueByName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const match = Object.entries(MAJOR_LEAGUES).find(
    ([leagueName]) => leagueName.toLowerCase() === normalized
  );
  if (match) return { name: match[0], id: match[1] };

  const partial = Object.entries(MAJOR_LEAGUES).find(([leagueName]) =>
    leagueName.toLowerCase().includes(normalized)
  );
  return partial ? { name: partial[0], id: partial[1] } : null;
}

module.exports = { MAJOR_LEAGUES, MAJOR_LEAGUE_IDS, findLeagueByName };
