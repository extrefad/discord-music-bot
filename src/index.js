require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const { DisTube } = require('distube');
const fs   = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// DisTube v5 tem YouTube embutido — sem plugin necessário
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  joinNewVoiceChannel: false,
});

client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel?.send(
      '🎵 **Tocando agora:**\n' +
      '> **' + song.name + '**\n' +
      '> 👤 ' + (song.user?.displayName || 'Alguém') +
      ' | ⏱️ ' + song.formattedDuration
    );
  })
  .on('addSong', (queue, song) => {
    queue.textChannel?.send(
      '✅ **' + song.name + '** adicionada à fila!\n' +
      '> ⏱️ ' + song.formattedDuration +
      ' | 📋 Posição: ' + queue.songs.length
    );
  })
  .on('finish', queue => {
    queue.textChannel?.send('✅ Fila finalizada! Use `/tocar` para adicionar mais músicas.');
  })
  .on('disconnect', queue => {
    queue.textChannel?.send('🔌 Voxara foi desconectado. Use `/tocar` para chamar novamente!');
  })
  .on('error', (channel, error) => {
    console.error('DisTube erro:', error.message);
    channel?.send('❌ Erro ao reproduzir. Tente novamente!');
  });

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsJson = [];

for (const file of commandFiles) {
  const mod  = require(path.join(commandsPath, file));
  const list = Array.isArray(mod) ? mod : [mod];
  for (const cmd of list) {
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
      commandsJson.push(cmd.data.toJSON());
      console.log('✅ Comando: /' + cmd.data.name);
    }
  }
}

const activities = [
  { name: '🎵 /tocar para começar',  type: ActivityType.Playing   },
  { name: '🔊 Ouvindo o servidor',   type: ActivityType.Listening },
  { name: '🎙️ Voxara Music Bot',     type: ActivityType.Watching  },
];

function rotateActivity() {
  const act = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(act.name, { type: act.type });
}

client.once('clientReady', async () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🎙️  VOXARA está online!             ║');
  console.log('║   Bot: ' + client.user.tag.padEnd(28) + '║');
  console.log('║   Servidores: ' + String(client.guilds.cache.size).padEnd(23) + '║');
  console.log('╚══════════════════════════════════════╝\n');

  try {
    const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commandsJson });
    console.log('✅ ' + commandsJson.length + ' comandos registrados!\n');
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
    console.error('Erro no comando /' + interaction.commandName + ':', error.message);
    const msg = { content: '❌ Erro ao executar o comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);
