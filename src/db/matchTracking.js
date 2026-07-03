const db = require('./database');

const upsertStatusStmt = db.prepare(`
  INSERT INTO fixture_status (fixture_id, last_status, last_home_goals, last_away_goals, resolved)
  VALUES (@fixtureId, @status, @homeGoals, @awayGoals, 0)
  ON CONFLICT(fixture_id) DO UPDATE SET
    last_status = excluded.last_status,
    last_home_goals = excluded.last_home_goals,
    last_away_goals = excluded.last_away_goals
`);
const getStatusStmt = db.prepare(`SELECT * FROM fixture_status WHERE fixture_id = ?`);
const markFixtureResolvedStmt = db.prepare(`
  UPDATE fixture_status SET resolved = 1 WHERE fixture_id = ?
`);
const listActiveStmt = db.prepare(`
  SELECT fixture_id FROM fixture_status WHERE resolved = 0
`);

function getLastStatus(fixtureId) {
  return getStatusStmt.get(fixtureId) || null;
}

function updateFixtureState(fixtureId, status, homeGoals, awayGoals) {
  upsertStatusStmt.run({ fixtureId, status, homeGoals, awayGoals });
}

function markFixtureResolved(fixtureId) {
  markFixtureResolvedStmt.run(fixtureId);
}

function listActiveFixtureIds() {
  return listActiveStmt.all().map((r) => r.fixture_id);
}

module.exports = {
  getLastStatus,
  updateFixtureState,
  markFixtureResolved,
  listActiveFixtureIds,
};
