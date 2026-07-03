require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Warning: environment variable ${name} is not set.`);
  }
  return value;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  devGuildId: process.env.DISCORD_DEV_GUILD_ID || null,

  footballDataApiKey: required('FOOTBALL_DATA_API_KEY'),
  footballDataBaseUrl: 'https://api.football-data.org/v4',

  // football-data.org's free tier is capped at 10 requests/minute; keep the
  // poll interval at or above this floor so a single tick can't itself queue
  // up more than the budget allows.
  livePollIntervalSeconds: Math.max(Number(process.env.LIVE_POLL_INTERVAL_SECONDS) || 60, 60),
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
};
