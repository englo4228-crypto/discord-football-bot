const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../db/settings');

const data = new SlashCommandBuilder()
  .setName('setpunditrole')
  .setDescription('Set the role automatically given to the top prediction scorer on this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addRoleOption((opt) =>
    opt.setName('role').setDescription('Role to award, e.g. "Tactical Genius"').setRequired(true)
  );

async function execute(interaction) {
  const role = interaction.options.getRole('role', true);
  settings.setPunditRole(interaction.guildId, role.id);
  await interaction.reply(
    `✅ **${role.name}** will now be automatically awarded to the top predictor after each resolved match.`
  );
}

module.exports = { data, execute };
