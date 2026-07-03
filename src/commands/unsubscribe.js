const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const subscriptions = require('../db/subscriptions');

const data = new SlashCommandBuilder()
  .setName('unsubscribe')
  .setDescription('Stop auto-posting live events for a subscription in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption((opt) =>
    opt
      .setName('subscription_id')
      .setDescription('The ID shown in /subscriptions for this channel')
      .setRequired(true)
  );

async function execute(interaction) {
  const subscriptionId = interaction.options.getInteger('subscription_id', true);
  const channelSubs = subscriptions.listForChannel(interaction.channelId);
  const target = channelSubs.find((s) => s.id === subscriptionId);

  if (!target) {
    await interaction.reply({
      content: 'No subscription with that ID exists in this channel. Run `/subscriptions` to see the list.',
      ephemeral: true,
    });
    return;
  }

  subscriptions.removeSubscription({
    channelId: interaction.channelId,
    type: target.type,
    targetId: target.target_id,
  });

  await interaction.reply({
    content: `✅ Removed subscription to **${target.target_name}** from this channel.`,
    ephemeral: true,
  });
}

module.exports = { data, execute };
