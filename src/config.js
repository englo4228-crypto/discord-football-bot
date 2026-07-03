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

  footballApiKey: required('FOOTBALL_API_KEY'),
  footballApiHost: process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io',

  livePollIntervalSeconds: Number(process.env.LIVE_POLL_INTERVAL_SECONDS) || 60,
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  footballSeason: Number(process.env.FOOTBALL_SEASON) || new Date().getFullYear(),
};
