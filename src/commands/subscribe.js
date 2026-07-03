const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const footballApi = require('../api/footballApi');
const subscriptions = require('../db/subscriptions');
const { findLeagueByName } = require('../utils/leagues');

const data = new SlashCommandBuilder()
  .setName('subscribe')
  .setDescription('Auto-post live events for a team or league into a channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Subscribe to a team or an entire league')
      .setRequired(true)
      .addChoices({ name: 'team', value: 'team' }, { name: 'league', value: 'league' })
  )
  .addStringOption((opt) =>
    opt.setName('name').setDescription('Team or league name').setRequired(true)
  )
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Channel to post updates in (default: this channel)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const type = interaction.options.getString('type', true);
  const name = interaction.options.getString('name', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  let targetId;
  let targetName;

  if (type === 'league') {
    const league = findLeagueByName(name);
    if (!league) {
      await interaction.editReply(`Couldn't find a tracked league matching "${name}".`);
      return;
    }
    targetId = league.id;
    targetName = league.name;
  } else {
    const teams = await footballApi.searchTeam(name);
    if (teams.length === 0) {
      await interaction.editReply(`Couldn't find a team matching "${name}".`);
      return;
    }
    targetId = teams[0].team.id;
    targetName = teams[0].team.name;
  }

  subscriptions.addSubscription({
    guildId: interaction.guildId,
    channelId: channel.id,
    type,
    targetId,
    targetName,
  });

  await interaction.editReply(
    `✅ ${channel} will now receive live event updates for **${targetName}**.`
  );
}

module.exports = { data, execute };
