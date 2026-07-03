const { SlashCommandBuilder } = require('discord.js');
const predictions = require('../db/predictions');
const { leaderboardEmbed } = require('../utils/embeds');

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show the top match predictors on this server');

async function execute(interaction) {
  await interaction.deferReply();

  const rows = predictions.getLeaderboard(interaction.guildId, 10);
  const embed = leaderboardEmbed(interaction.guild.name, rows, (userId) => `<@${userId}>`);
  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
