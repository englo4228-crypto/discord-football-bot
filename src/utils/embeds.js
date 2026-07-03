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
  if (['1H', '2H', 'ET', 'P', 'LIVE'].includes(status.short)) return `${status.elapsed}'`;
  if (status.short === 'FT') return 'Full-time';
  if (status.short === 'NS') return 'Not started';
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

/** Rich embed for a single match/event feed post. */
function eventEmbed(fixture, event) {
  const type = (event.type || '').toLowerCase();
  const detail = (event.detail || '').toLowerCase();

  let emoji = 'ℹ️';
  let color = COLORS.info;
  if (type === 'goal') {
    emoji = detail.includes('penalty') ? '🎯' : '⚽';
    color = COLORS.goal;
  } else if (type === 'card') {
    if (detail.includes('red')) {
      emoji = '🟥';
      color = COLORS.redCard;
    } else {
      emoji = '🟨';
      color = COLORS.yellowCard;
    }
  } else if (type === 'subst') {
    emoji = '🔄';
    color = COLORS.subst;
  } else if (type === 'var') {
    emoji = '🖥️';
    color = COLORS.var;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}` })
    .setTimestamp();

  const minute = event.time.elapsed + (event.time.extra ? `+${event.time.extra}` : '');
  let description = `${emoji} **${event.type}** — ${event.detail} (${minute}')\n`;
  description += `${event.team.name}: **${event.player?.name || 'Unknown'}**`;
  if (event.assist?.name && type === 'goal') {
    description += ` (assist: ${event.assist.name})`;
  }
  if (type === 'subst' && event.assist?.name) {
    description += ` ⬅ ${event.assist.name}`;
  }
  if (event.comments) {
    description += `\n*${event.comments}*`;
  }
  description += `\n\n${scoreLine(fixture)}`;

  embed.setDescription(description);
  embed.setThumbnail(fixture.league.logo || null);
  return embed;
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

function playerEmbed(playerData) {
  const { player, statistics } = playerData;
  const stat = statistics[0] || {};
  const embed = new EmbedBuilder()
    .setTitle(`👤 ${player.name}`)
    .setColor(COLORS.info)
    .setThumbnail(player.photo || null)
    .addFields(
      { name: 'Team', value: stat.team?.name || 'N/A', inline: true },
      { name: 'Position', value: stat.games?.position || 'N/A', inline: true },
      { name: 'Appearances', value: String(stat.games?.appearences ?? 0), inline: true },
      { name: 'Goals', value: String(stat.goals?.total ?? 0), inline: true },
      { name: 'Assists', value: String(stat.goals?.assists ?? 0), inline: true },
      { name: 'Clean sheets', value: String(stat.goals?.conceded != null ? stat.goals.conceded : 'N/A'), inline: true },
      { name: 'Pass accuracy', value: stat.passes?.accuracy ? `${stat.passes.accuracy}%` : 'N/A', inline: true },
      { name: 'Yellow cards', value: String(stat.cards?.yellow ?? 0), inline: true },
      { name: 'Red cards', value: String(stat.cards?.red ?? 0), inline: true }
    )
    .setTimestamp();
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
    .setTitle(`📈 ${teamName} — Recent Form`)
    .setColor(COLORS.info)
    .setDescription(formToEmojis(stats.form))
    .addFields(
      { name: 'Played', value: String(stats.fixtures?.played?.total ?? 0), inline: true },
      { name: 'Wins', value: String(stats.fixtures?.wins?.total ?? 0), inline: true },
      { name: 'Draws', value: String(stats.fixtures?.draws?.total ?? 0), inline: true },
      { name: 'Losses', value: String(stats.fixtures?.loses?.total ?? 0), inline: true },
      { name: 'Goals For', value: String(stats.goals?.for?.total?.total ?? 0), inline: true },
      { name: 'Goals Against', value: String(stats.goals?.against?.total?.total ?? 0), inline: true }
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
  eventEmbed,
  kickoffPingEmbed,
  fullTimeEmbed,
  fixturesListEmbed,
  standingsEmbed,
  playerEmbed,
  formEmbed,
  formToEmojis,
  leaderboardEmbed,
};
