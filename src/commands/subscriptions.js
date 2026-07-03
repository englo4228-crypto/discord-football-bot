const { SlashCommandBuilder } = require('discord.js');
const subscriptions = require('../db/subscriptions');

const data = new SlashCommandBuilder()
  .setName('subscriptions')
  .setDescription('List the live-event subscriptions active in this channel');

async function execute(interaction) {
  const rows = subscriptions.listForChannel(interaction.channelId);

  if (rows.length === 0) {
    await interaction.reply({
      content: 'This channel has no active subscriptions. Use `/subscribe` to add one.',
      ephemeral: true,
    });
    return;
  }

  const lines = rows.map((row) => `\`#${row.id}\` — ${row.type}: **${row.target_name}**`);
  await interaction.reply({
    content: `**Subscriptions for this channel:**\n${lines.join('\n')}`,
    ephemeral: true,
  });
}

module.exports = { data, execute };
