const { SlashCommandBuilder } = require('discord.js');
const settings = require('../db/settings');
const { isValidTimezone } = require('../utils/time');

const data = new SlashCommandBuilder()
  .setName('timezone')
  .setDescription('Set your personal timezone for match kickoff times')
  .addStringOption((opt) =>
    opt
      .setName('tz')
      .setDescription('IANA timezone name, e.g. "Asia/Kolkata" or "America/New_York"')
      .setRequired(true)
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

  settings.setUserTimezone(interaction.user.id, tz);
  await interaction.reply({
    content: `✅ Your timezone is set to **${tz}**. Kickoff times you request will show in this timezone.`,
    ephemeral: true,
  });
}

module.exports = { data, execute };
