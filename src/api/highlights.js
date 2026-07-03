const axios = require('axios');
const { cached } = require('../utils/cache');

// Best-effort highlights lookup via Scorebat's free public feed
// (https://www.scorebat.com/video-api/). This feed only covers a subset of
// competitions and has no auth on the free tier, so a miss is expected and
// handled gracefully by callers.
const FEED_URL = 'https://www.scorebat.com/video-api/v3/feed/';

async function getRecentHighlights() {
  return cached('scorebat-feed', 5 * 60_000, async () => {
    try {
      const { data } = await axios.get(FEED_URL, { timeout: 8000 });
      return data.response || [];
    } catch (err) {
      console.warn('[highlights] Scorebat feed unavailable:', err.message);
      return [];
    }
  });
}

/** Finds a highlight clip whose title mentions both team names, if the feed has one. */
async function findHighlightForFixture(homeTeam, awayTeam) {
  const feed = await getRecentHighlights();
  const home = homeTeam.toLowerCase();
  const away = awayTeam.toLowerCase();
  const match = feed.find((item) => {
    const title = (item.title || '').toLowerCase();
    return title.includes(home) && title.includes(away);
  });
  return match ? { title: match.title, url: match.matchviewUrl || match.url } : null;
}

module.exports = { findHighlightForFixture };
