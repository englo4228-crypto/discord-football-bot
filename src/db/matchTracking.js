const db = require('./database');

const insertEventStmt = db.prepare(`
  INSERT OR IGNORE INTO posted_events (fixture_id, event_key) VALUES (?, ?)
`);
const hasEventStmt = db.prepare(`
  SELECT 1 FROM posted_events WHERE fixture_id = ? AND event_key = ?
`);
const clearFixtureEventsStmt = db.prepare(`
  DELETE FROM posted_events WHERE fixture_id = ?
`);

const upsertStatusStmt = db.prepare(`
  INSERT INTO fixture_status (fixture_id, last_status, resolved) VALUES (?, ?, 0)
  ON CONFLICT(fixture_id) DO UPDATE SET last_status = excluded.last_status
`);
const getStatusStmt = db.prepare(`SELECT * FROM fixture_status WHERE fixture_id = ?`);
const markFixtureResolvedStmt = db.prepare(`
  UPDATE fixture_status SET resolved = 1 WHERE fixture_id = ?
`);
const listActiveStmt = db.prepare(`
  SELECT fixture_id FROM fixture_status WHERE resolved = 0
`);

function hasPostedEvent(fixtureId, eventKey) {
  return Boolean(hasEventStmt.get(fixtureId, eventKey));
}

function markEventPosted(fixtureId, eventKey) {
  insertEventStmt.run(fixtureId, eventKey);
}

function clearFixtureEvents(fixtureId) {
  clearFixtureEventsStmt.run(fixtureId);
}

function getLastStatus(fixtureId) {
  return getStatusStmt.get(fixtureId) || null;
}

function setLastStatus(fixtureId, status) {
  upsertStatusStmt.run(fixtureId, status);
}

function markFixtureResolved(fixtureId) {
  markFixtureResolvedStmt.run(fixtureId);
}

function listActiveFixtureIds() {
  return listActiveStmt.all().map((r) => r.fixture_id);
}

module.exports = {
  hasPostedEvent,
  markEventPosted,
  clearFixtureEvents,
  getLastStatus,
  setLastStatus,
  markFixtureResolved,
  listActiveFixtureIds,
};
