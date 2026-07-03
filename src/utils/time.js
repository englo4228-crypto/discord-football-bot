const settings = require('../db/settings');
const config = require('../config');

/** Resolves the timezone to display times in for a given user/guild context. */
function resolveTimezone({ userId, guildId }) {
  const userTz = userId ? settings.getUserTimezone(userId) : null;
  if (userTz) return userTz;

  const guildSettings = guildId ? settings.getGuildSettings(guildId) : null;
  if (guildSettings?.timezone) return guildSettings.timezone;

  return config.defaultTimezone;
}

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Formats an ISO kickoff time in the given IANA timezone, e.g. "Sat 20:00 (Europe/London)". */
function formatKickoff(isoString, timezone) {
  const date = new Date(isoString);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
  return `${formatted} (${timezone})`;
}

module.exports = { resolveTimezone, isValidTimezone, formatKickoff };
