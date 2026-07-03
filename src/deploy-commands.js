const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const commandsPath = path.join(__dirname, 'commands');
const commands = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'))
  .map((file) => require(path.join(commandsPath, file)).data.toJSON());

const rest = new REST().setToken(config.discordToken);

(async () => {
  try {
    const route = config.devGuildId
      ? Routes.applicationGuildCommands(config.discordClientId, config.devGuildId)
      : Routes.applicationCommands(config.discordClientId);

    console.log(`Deploying ${commands.length} slash commands${config.devGuildId ? ' (dev guild)' : ' (global)'}...`);
    await rest.put(route, { body: commands });
    console.log('Slash commands deployed successfully.');
  } catch (err) {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
  }
})();
