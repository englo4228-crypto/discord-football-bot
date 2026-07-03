const { SlashCommandBuilder } = require('discord.js');
const footballApi = require('../api/footballApi');
const { playerEmbed } = require('../utils/embeds');

const data = new SlashCommandBuilder()
  .setName('player')
  .setDescription("Look up a player's season stats")
  .addStringOption((opt) => opt.setName('name').setDescription('Player name').setRequired(true));

async function execute(interaction) {
  await interaction.deferReply();

  const name = interaction.options.getString('name', true);
  const results = await footballApi.searchPlayer(name);

  if (results.length === 0) {
    await interaction.editReply(`Couldn't find a player matching "${name}".`);
    return;
  }

  await interaction.editReply({ embeds: [playerEmbed(results[0])] });
}

module.exports = { data, execute };
