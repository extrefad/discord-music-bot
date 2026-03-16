require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { LocalMusicPlayer } = require('./player/LocalMusicPlayer');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.localPlayer = new LocalMusicPlayer({
  musicDir: path.join(__dirname, 'music'),
});

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
const commandsJson = [];

for (const file of commandFiles) {
  const mod = require(path.join(commandsPath, file));
  const list = Array.isArray(mod) ? mod : [mod];
  for (const cmd of list) {
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
      commandsJson.push(cmd.data.toJSON());
      console.log(`✅ Comando: /${cmd.data.name}`);
    }
  }
}

const activities = [
  { name: '📁 Modo offline local', type: ActivityType.Playing },
  { name: '🎵 /biblioteca para listar músicas', type: ActivityType.Listening },
  { name: '🪟 Otimizado para Windows', type: ActivityType.Watching },
];

function rotateActivity() {
  const act = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(act.name, { type: act.type });
}

client.once('clientReady', async () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🎙️  VOXARA OFFLINE está online!      ║');
  console.log(`║   Bot: ${client.user.tag.padEnd(28)}║`);
  console.log(`║   Servidores: ${String(client.guilds.cache.size).padEnd(23)}║`);
  console.log('╚══════════════════════════════════════╝\n');

  console.log(`📁 Biblioteca local: ${client.localPlayer.getLibrary().length} arquivo(s) em src/music`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commandsJson });
    console.log(`✅ ${commandsJson.length} comandos registrados!\n`);
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err.message);
  }

  rotateActivity();
  setInterval(rotateActivity, 30_000);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}:`, error.message);
    const msg = { content: '❌ Erro ao executar o comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);
