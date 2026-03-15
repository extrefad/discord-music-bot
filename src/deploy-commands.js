require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const mod = require(path.join(commandsPath, file));
  const list = Array.isArray(mod) ? mod : [mod];
  for (const cmd of list) {
    if (cmd.data) commands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Registrando ${commands.length} comando(s)...`);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    const data = await rest.put(route, { body: commands });
    console.log(`✅ ${data.length} comando(s) registrado(s)!`);
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
})();
