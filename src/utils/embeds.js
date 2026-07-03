const { EmbedBuilder } = require('discord.js');
const { formatKickoff } = require('./time');

const COLORS = {
  live: 0x2ecc71,
  goal: 0xf1c40f,
  redCard: 0xe74c3c,
  yellowCard: 0xf39c12,
  subst: 0x3498db,
  var: 0x9b59b6,
  info: 0x5865f2,
  final: 0x95a5a6,
};

function statusLabel(status) {
  if (status.short === 'HT') return 'Half-time';
  if (status.short === '1H') return status.elapsed != null ? `${status.elapsed}'` : 'Live';
  if (status.short === 'FT' || status.short === 'AWD') return 'Full-time';
  if (status.short === 'NS') return 'Not started';
  if (status.short === 'SUSP') return 'Suspended';
  if (status.short === 'PST') return 'Postponed';
  if (status.short === 'CANC') return 'Cancelled';
  return status.long;
}

function scoreLine(fixture) {
  const { teams, goals } = fixture;
  const home = goals.home ?? 0;
  const away = goals.away ?? 0;
  return `**${teams.home.name}** ${home} - ${away} **${teams.away.name}**`;
}

/** One embed summarising all currently live matches, grouped by league. */
function liveMatchesEmbed(fixtures) {
  const embed = new EmbedBuilder()
    .setTitle('⚽ Live Matches')
    .setColor(COLORS.live)
    .setTimestamp();

  if (fixtures.length === 0) {
    embed.setDescription('No live matches right now in the tracked leagues.');
    return embed;
  }

  const byLeague = new Map();
  for (const fixture of fixtures) {
    const key = `${fixture.league.name} (${fixture.league.country})`;
    if (!byLeague.has(key)) byLeague.set(key, []);
    byLeague.get(key).push(fixture);
  }

  for (const [league, matches] of byLeague) {
    const lines = matches.map(
      (f) => `${scoreLine(f)} — *${statusLabel(f.fixture.status)}*`
    );
    embed.addFields({ name: league, value: lines.join('\n').slice(0, 1024) });
  }

  return embed;
}

/**
 * Goal notification posted when the live score changes. football-data.org's
 * free tier doesn't expose minute-by-minute event data (scorer, assist, cards,
 * subs), so this is a score-diff-based ping rather than a full event feed.
 */
function goalEmbed(fixture, scoringTeamName) {
  return new EmbedBuilder()
    .setColor(COLORS.goal)
    .setAuthor({ name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}` })
    .setDescription(`⚽ **Goal for ${scoringTeamName}!**\n\n${scoreLine(fixture)}`)
    .setThumbnail(fixture.league.logo || null)
    .setTimestamp();
}

function kickoffPingEmbed(fixture) {
  return new EmbedBuilder()
    .setColor(COLORS.live)
    .setTitle('🟢 Kick-off!')
    .setDescription(`${scoreLine(fixture)}\n${fixture.league.name}, ${fixture.league.round}`)
    .setThumbnail(fixture.league.logo || null)
    .setTimestamp();
}

function fullTimeEmbed(fixture) {
  return new EmbedBuilder()
    .setColor(COLORS.final)
    .setTitle('🏁 Full-time')
    .setDescription(`${scoreLine(fixture)}\n${fixture.league.name}, ${fixture.league.round}`)
    .setThumbnail(fixture.league.logo || null)
    .setTimestamp();
}

function fixturesListEmbed(fixtures, { leagueName, timezone } = {}) {
  const embed = new EmbedBuilder()
    .setTitle(leagueName ? `📅 Fixtures — ${leagueName}` : '📅 Fixtures')
    .setColor(COLORS.info)
    .setTimestamp();

  if (fixtures.length === 0) {
    embed.setDescription('No fixtures found for that search.');
    return embed;
  }

  const lines = fixtures.slice(0, 20).map((f) => {
    const kickoff = formatKickoff(f.fixture.date, timezone);
    return `**${f.teams.home.name}** vs **${f.teams.away.name}** — ${kickoff}`;
  });

  embed.setDescription(lines.join('\n'));
  return embed;
}

function standingsEmbed(leagueName, standings) {
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${leagueName} — Table`)
    .setColor(COLORS.info)
    .setTimestamp();

  if (!standings || standings.length === 0) {
    embed.setDescription('No standings data available.');
    return embed;
  }

  const header = '`#  Team                     P   W  D  L   GD  Pts`';
  const rows = standings.map((row) => {
    const pos = String(row.rank).padStart(2, ' ');
    const name = row.team.name.slice(0, 22).padEnd(24, ' ');
    const played = String(row.all.played).padStart(2, ' ');
    const win = String(row.all.win).padStart(2, ' ');
    const draw = String(row.all.draw).padStart(2, ' ');
    const lose = String(row.all.lose).padStart(2, ' ');
    const gd = String(row.goalsDiff >= 0 ? `+${row.goalsDiff}` : row.goalsDiff).padStart(4, ' ');
    const pts = String(row.points).padStart(3, ' ');
    return `\`${pos}  ${name} ${played}  ${win} ${draw} ${lose}  ${gd} ${pts}\``;
  });

  embed.setDescription([header, ...rows].join('\n').slice(0, 4096));
  return embed;
}

function formToEmojis(form) {
  if (!form) return 'N/A';
  return [...form]
    .map((c) => ({ W: '🟢', D: '⚪', L: '🔴' }[c] || c))
    .join(' ');
}

function formEmbed(teamName, stats) {
  const embed = new EmbedBuilder()
    .setTitle(`📈 ${teamName} — Recent Form (last ${stats.played})`)
    .setColor(COLORS.info)
    .setDescription(formToEmojis(stats.form))
    .addFields(
      { name: 'Wins', value: String(stats.wins ?? 0), inline: true },
      { name: 'Draws', value: String(stats.draws ?? 0), inline: true },
      { name: 'Losses', value: String(stats.losses ?? 0), inline: true },
      { name: 'Goals For', value: String(stats.goalsFor ?? 0), inline: true },
      { name: 'Goals Against', value: String(stats.goalsAgainst ?? 0), inline: true }
    )
    .setTimestamp();
  return embed;
}

function leaderboardEmbed(guildName, rows, resolveTag) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 Prediction Leaderboard — ${guildName}`)
    .setColor(COLORS.goal)
    .setTimestamp();

  if (rows.length === 0) {
    embed.setDescription('No predictions have been scored yet. Use `/predict` before kickoff!');
    return embed;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((row, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const accuracy = row.total_predictions
      ? Math.round((row.correct_predictions / row.total_predictions) * 100)
      : 0;
    return `${rank} ${resolveTag(row.user_id)} — **${row.points} pts** (${accuracy}% accuracy, ${row.total_predictions} predictions)`;
  });

  embed.setDescription(lines.join('\n'));
  return embed;
}

module.exports = {
  COLORS,
  statusLabel,
  scoreLine,
  liveMatchesEmbed,
  goalEmbed,
  kickoffPingEmbed,
  fullTimeEmbed,
  fixturesListEmbed,
  standingsEmbed,
  formEmbed,
  formToEmojis,
  leaderboardEmbed,
};
