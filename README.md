# Discord Football Score Bot

A Discord bot that delivers live football (soccer) scores, standings, and a
channel-based prediction game — built with
[discord.js](https://discord.js.org/) and the
[Football-Data.org](https://www.football-data.org/) API (free tier: 10
requests/minute, no daily cap, 12 major competitions).

## Features

**Core scores & data**
- `/live` (alias `/scores`) — snapshot of all matches currently being played, grouped by league. Optional `league` filter.
- Live goal feed — once a channel is subscribed, the bot pings ⚽ when the scoreline changes for a subscribed team/league. See [Data provider limitations](#data-provider-limitations) — there's no scorer name, cards, subs, or VAR data on the free tier.
- `/fixtures [date] [league] [team]` — search upcoming matches.
- `/table <league>` — live-updated league standings.
- `/form <team>` — recent form as a W-D-L emoji strip over the last 5 finished matches.
- `/topscorers <league>` — top 10 goalscorers in a competition this season.

**Server customization**
- `/subscribe type:<team|league> name:<...> [channel]` — lock a channel to auto-post goal updates for a team or league (admin-only, requires Manage Channels).
- `/unsubscribe subscription_id:<id>` / `/subscriptions` — manage a channel's subscriptions.
- `/favorite team:<name>` — self-assign a `<Team> Fan` role (auto-created); the bot pings that role on kickoff and goals for the team.
- `/timezone tz:<IANA name>` and `/servertimezone tz:<IANA name>` — personal and server-default kickoff time localization.

**Predictions & gamification**
- `/predict fixture:<autocomplete> home_score away_score` — guess the scoreline before kickoff (locks at kickoff).
- Scoring: 3 pts for an exact score, 1 pt for correctly picking the winner/draw.
- `/leaderboard` — top predictors per server.
- `/setpunditrole role:<@role>` — a role (e.g. "Tactical Genius") is automatically moved to whoever leads the prediction leaderboard after each resolved match.
- Full-time posts to subscribed channels include a best-effort highlight link when available.

## Data provider limitations

Football-Data.org's free tier trades a generous, sustainable rate limit
(10 req/min forever, vs. e.g. 100 req/**day** on some competitors) for a
narrower data surface. Compared to a paid provider, this bot's free-tier build
**does not** have:

- Minute-by-minute match events — no goalscorer/assist names, no card or
  substitution feed, no VAR notifications. The live feed posts a generic
  "⚽ Goal for `<Team>`!" message (derived by diffing the scoreline between
  polls), not a scorer.
- Live in-game statistics (possession, shots, xG, corners, fouls) — not
  offered by this provider at any tier, so there's no `/stats` command.
- Arbitrary player lookup/season stats — replaced with `/topscorers`, which
  uses the one player dataset the API does expose (a competition's top
  scorers list).
- Team search by name — there's no such endpoint, so the bot builds its own
  index by caching each tracked competition's team list (see
  `footballApi.searchTeam`/`warmTeamCache`) and only finds teams within the
  12 tracked competitions.
- A first-goalscorer bonus in `/predict` — dropped entirely, since it can't
  be resolved without event data.

If you upgrade to a paid Football-Data.org tier or want the fuller feature
set, swapping in a richer provider (e.g. API-Football) mainly touches
`src/api/footballApi.js` — the rest of the bot consumes a normalized match
shape (`normalizeMatch`) so most commands/services wouldn't need to change.

## Architecture

```
src/
  index.js                 Bot entry point: loads commands, wires interactions, starts the poller, warms the team cache
  deploy-commands.js       Registers slash commands with Discord
  config.js                Environment configuration
  api/
    footballApi.js         Football-Data.org v4 client; normalizes matches/standings into an internal shape
    highlights.js          Best-effort highlight lookup (Scorebat free feed)
  db/
    database.js            SQLite schema (better-sqlite3)
    subscriptions.js        Channel <-> team/league subscriptions
    teamRoles.js            Guild fan-role mapping
    settings.js             Per-user/per-guild timezone + pundit role settings
    predictions.js          Predictions + leaderboard scoring
    matchTracking.js        Tracks fixture status/score so the poller can diff and resolve matches once
  services/
    liveEventPoller.js      Polls live fixtures, posts kickoff/goal updates to subscribed channels
    matchEndService.js      Resolves predictions, syncs pundit role, posts full-time + highlights
  commands/                 One file per slash command ({ data, execute[, autocomplete] })
  utils/
    embeds.js               Discord embed builders (colors, formatting)
    time.js                 Timezone resolution/formatting
    leagues.js              League name -> Football-Data.org competition code map
    cache.js                In-memory TTL cache
    rateLimiter.js           Sliding-window limiter enforcing the 10 req/min API cap
```

Data persists in a local SQLite file at `data/bot.sqlite3` (created automatically, gitignored).

## Setup

1. **Create a Discord application** at the [Discord Developer Portal](https://discord.com/developers/applications), add a Bot user, and copy the token + application (client) ID. Under OAuth2 URL Generator, select the `bot` and `applications.commands` scopes with `Send Messages`, `Manage Roles`, `Embed Links` permissions to generate an invite link.
   - Enable the **Server Members Intent** in the Bot settings (needed for role assignment).
2. **Get a Football-Data.org API key** by registering at [football-data.org/client/register](https://www.football-data.org/client/register) (free, no card required).
3. **Configure environment:**
   ```bash
   cp .env.example .env
   # then fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, FOOTBALL_DATA_API_KEY, etc.
   ```
4. **Install dependencies:**
   ```bash
   npm install
   ```
5. **Register slash commands** (re-run whenever command definitions change):
   ```bash
   npm run deploy-commands
   ```
   Set `DISCORD_DEV_GUILD_ID` in `.env` while developing for instant command updates in one server; leave it blank for global registration (takes up to ~1 hour to propagate).
6. **Run the bot:**
   ```bash
   npm start
   ```

## Notes & limitations

- Every Football-Data.org call — across all commands and the poller, for every guild — funnels through one shared 10-requests/minute limiter (`src/utils/rateLimiter.js`). Under heavy concurrent use (many simultaneous commands, many subscribed live matches), requests queue and responses slow down rather than erroring; this is expected given the free tier.
- The live poller only watches fixtures matching an active `/subscribe`; without any subscriptions it stays idle to conserve API quota. `/live`, `/fixtures`, etc. work regardless of subscriptions.
- The first `/subscribe`, `/favorite`, `/fixtures team:`, or `/form` after a cold start may be slow (up to ~70s) while the team-name index warms up across 12 competitions; `index.js` kicks this off in the background on startup so it's usually already warm by the time anyone runs a command.
- Match highlight links depend on Scorebat's free public feed, which doesn't cover every competition — this is best-effort and silently skipped when no clip is found.
- Role pings on goals/kickoffs require a fan role to have been created via `/favorite` for that team in the relevant guild.
- `/table`, `/fixtures`, `/topscorers` league filters are limited to the 12 competitions listed in `src/utils/leagues.js` (the free tier's full coverage); it isn't possible to add more without a paid plan.
