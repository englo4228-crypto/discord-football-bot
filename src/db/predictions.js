const db = require('./database');

const insertStmt = db.prepare(`
  INSERT INTO predictions
    (guild_id, user_id, fixture_id, home_team, away_team, predicted_home, predicted_away, first_scorer, kickoff_utc)
  VALUES (@guildId, @userId, @fixtureId, @homeTeam, @awayTeam, @predictedHome, @predictedAway, @firstScorer, @kickoffUtc)
  ON CONFLICT(guild_id, user_id, fixture_id) DO UPDATE SET
    predicted_home = excluded.predicted_home,
    predicted_away = excluded.predicted_away,
    first_scorer = excluded.first_scorer
`);

const unresolvedForFixtureStmt = db.prepare(`
  SELECT * FROM predictions WHERE fixture_id = ? AND resolved = 0
`);

const markResolvedStmt = db.prepare(`
  UPDATE predictions SET points = ?, resolved = 1 WHERE id = ?
`);

const leaderboardStmt = db.prepare(`
  SELECT user_id, points, correct_predictions, total_predictions
  FROM user_scores
  WHERE guild_id = ?
  ORDER BY points DESC, correct_predictions DESC
  LIMIT ?
`);

const bumpUserScoreStmt = db.prepare(`
  INSERT INTO user_scores (guild_id, user_id, points, correct_predictions, total_predictions)
  VALUES (@guildId, @userId, @points, @correct, 1)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    points = user_scores.points + @points,
    correct_predictions = user_scores.correct_predictions + @correct,
    total_predictions = user_scores.total_predictions + 1
`);

const topScorerStmt = db.prepare(`
  SELECT user_id, points FROM user_scores WHERE guild_id = ? ORDER BY points DESC LIMIT 1
`);

function addOrUpdatePrediction(prediction) {
  return insertStmt.run(prediction);
}

function getUnresolvedForFixture(fixtureId) {
  return unresolvedForFixtureStmt.all(fixtureId);
}

function resolvePrediction(id, points) {
  return markResolvedStmt.run(points, id);
}

function bumpUserScore({ guildId, userId, points, correct }) {
  return bumpUserScoreStmt.run({ guildId, userId, points, correct: correct ? 1 : 0 });
}

function getLeaderboard(guildId, limit = 10) {
  return leaderboardStmt.all(guildId, limit);
}

function getTopScorer(guildId) {
  return topScorerStmt.get(guildId) || null;
}

module.exports = {
  addOrUpdatePrediction,
  getUnresolvedForFixture,
  resolvePrediction,
  bumpUserScore,
  getLeaderboard,
  getTopScorer,
};
