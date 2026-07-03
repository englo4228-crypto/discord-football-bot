const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../db/settings');
const { isValidTimezone } = require('../utils/time');

const data = new SlashCommandBuilder()
  .setName('servertimezone')
  .setDescription("Set this server's default timezone for members without a personal one")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt.setName('tz').setDescription('IANA timezone name, e.g. "Europe/Madrid"').setRequired(true)
  );

async function execute(interaction) {
  const tz = interaction.options.getString('tz', true);

  if (!isValidTimezone(tz)) {
    await interaction.reply({
      content: `"${tz}" isn't a recognized IANA timezone. Try something like \`Europe/London\` or \`America/Los_Angeles\`.`,
      ephemeral: true,
    });
    return;
  }

  settings.setGuildTimezone(interaction.guildId, tz);
  await interaction.reply(`✅ Server default timezone set to **${tz}**.`);
}

module.exports = { data, execute };
