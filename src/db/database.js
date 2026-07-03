const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.sqlite3'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('team', 'league')),
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(channel_id, type, target_id)
  );

  CREATE TABLE IF NOT EXISTS team_roles (
    guild_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, team_id)
  );

  CREATE TABLE IF NOT EXISTS user_timezones (
    user_id TEXT PRIMARY KEY,
    timezone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    timezone TEXT,
    pundit_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS fixture_status (
    fixture_id INTEGER PRIMARY KEY,
    last_status TEXT NOT NULL,
    last_home_goals INTEGER NOT NULL DEFAULT 0,
    last_away_goals INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    fixture_id INTEGER NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    predicted_home INTEGER NOT NULL,
    predicted_away INTEGER NOT NULL,
    kickoff_utc TEXT NOT NULL,
    points INTEGER,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, user_id, fixture_id)
  );

  CREATE TABLE IF NOT EXISTS user_scores (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    correct_predictions INTEGER NOT NULL DEFAULT 0,
    total_predictions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
`);

module.exports = db;
