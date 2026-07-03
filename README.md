# Discord Football Score Bot

A Discord bot that delivers live football (soccer) scores, real-time match
events, standings, stats, and a channel-based prediction game — built with
[discord.js](https://discord.js.org/) and the
[API-Football](https://www.api-football.com/) data API.

## Features

**Core scores & data**
- `/live` (alias `/scores`) — snapshot of all matches currently being played, grouped by league. Optional `league` filter.
- Live event feed — once a channel is subscribed, the bot auto-posts ⚽ goals (scorer + assist), 🟥/🟨 cards, 🔄 substitutions, and 🖥️ VAR/penalty events as they happen.
- `/fixtures [date] [league] [team]` — search upcoming matches.
- `/table <league>` — live-updated league standings.
- `/stats <fixture>` — live in-game stats: possession, shots on target, xG, corners, fouls.
- `/player <name>` — season stats: goals, assists, appearances, pass accuracy, cards.
- `/form <team>` — recent form as a W-D-L emoji strip plus season goal/record totals.

**Server customization**
- `/subscribe type:<team|league> name:<...> [channel]` — lock a channel to auto-post events for a team or league (admin-only, requires Manage Channels).
- `/unsubscribe subscription_id:<id>` / `/subscriptions` — manage a channel's subscriptions.
- `/favorite team:<name>` — self-assign a `<Team> Fan` role (auto-created); the bot pings that role on kickoff and goals for the team.
- `/timezone tz:<IANA name>` and `/servertimezone tz:<IANA name>` — personal and server-default kickoff time localization.

**Predictions & gamification**
- `/predict fixture:<autocomplete> home_score away_score [first_scorer]` — guess the scoreline before kickoff (locks at kickoff).
- Scoring: 3 pts exact score, 1 pt correct result, +1 bonus for correct first goalscorer.
- `/leaderboard` — top predictors per server.
- `/setpunditrole role:<@role>` — a role (e.g. "Tactical Genius") is automatically moved to whoever leads the prediction leaderboard after each resolved match.
- Full-time posts to subscribed channels include a best-effort highlight link when available.

## Architecture

```
src/
  index.js                 Bot entry point: loads commands, wires interactions, starts the poller
  deploy-commands.js       Registers slash commands with Discord
  config.js                Environment configuration
  api/
    footballApi.js         API-Football client (fixtures, standings, events, stats, players)
    highlights.js          Best-effort highlight lookup (Scorebat free feed)
  db/
    database.js            SQLite schema (better-sqlite3)
    subscriptions.js        Channel <-> team/league subscriptions
    teamRoles.js            Guild fan-role mapping
    settings.js             Per-user/per-guild timezone + pundit role settings
    predictions.js          Predictions + leaderboard scoring
    matchTracking.js        De-dupes posted events, tracks fixture status transitions
  services/
    liveEventPoller.js      Polls live fixtures, posts new events/kickoffs to subscribed channels
    matchEndService.js      Resolves predictions, syncs pundit role, posts full-time + highlights
  commands/                 One file per slash command ({ data, execute[, autocomplete] })
  utils/
    embeds.js               Discord embed builders (colors, formatting)
    time.js                 Timezone resolution/formatting
    leagues.js              League name -> API-Football league ID map
    cache.js                In-memory TTL cache (keeps API usage within free-tier limits)
```

Data persists in a local SQLite file at `data/bot.sqlite3` (created automatically, gitignored).

## Setup

1. **Create a Discord application** at the [Discord Developer Portal](https://discord.com/developers/applications), add a Bot user, and copy the token + application (client) ID. Under OAuth2 URL Generator, select the `bot` and `applications.commands` scopes with `Send Messages`, `Manage Roles`, `Embed Links` permissions to generate an invite link.
   - Enable the **Server Members Intent** in the Bot settings (needed for role assignment).
2. **Get an API-Football key** from [api-football.com](https://www.api-football.com/) (the free tier gives 100 requests/day — plenty for a handful of subscribed channels at the default 60s poll interval; upgrade for busier servers).
3. **Configure environment:**
   ```bash
   cp .env.example .env
   # then fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, FOOTBALL_API_KEY, etc.
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

- The live poller only watches fixtures matching an active `/subscribe`; without any subscriptions it stays idle to conserve API quota. `/live`, `/fixtures`, etc. work regardless of subscriptions.
- Match highlight links depend on Scorebat's free public feed, which doesn't cover every competition — this is best-effort and silently skipped when no clip is found.
- Role pings on goals/kickoffs require a fan role to have been created via `/favorite` for that team in the relevant guild.
- `/table` and `/fixtures` league filters are limited to the competitions listed in `src/utils/leagues.js`; add more `league name -> API-Football league ID` entries there to track additional competitions.
