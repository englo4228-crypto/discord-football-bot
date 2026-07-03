const { SlashCommandBuilder } = require('discord.js');
const live = require('./live');

const data = new SlashCommandBuilder()
  .setName('scores')
  .setDescription('Alias for /live — shows all matches currently being played');

module.exports = { data, execute: live.execute };
