<<<<<<< HEAD
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// DISTUBE
client.distube = new DisTube(client, {
  plugins: [new YtDlpPlugin()],
  emitNewSongOnly: true
});

// EVENTOS DISTUBE
client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel?.send(
      `🎵 **Tocando agora:**\n` +
      `> **${song.name}**\n` +
      `> 👤 ${song.user?.displayName || 'Usuário'} | ⏱️ ${song.formattedDuration}`
    ).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    queue.textChannel?.send(
      `✅ **${song.name}** adicionada à fila!\n` +
      `> ⏱️ ${song.formattedDuration} | 📋 Posição: ${queue.songs.length}`
    ).catch(() => {});
  })
  .on('finish', queue => {
    queue.textChannel?.send('✅ Fila finalizada!').catch(() => {});
  })
  .on('disconnect', queue => {
    queue.textChannel?.send('🔌 Voxara desconectado.').catch(() => {});
  })
  .on('error', (channel, error) => {
    console.error('DisTube erro:', error);
    channel?.send('❌ Erro ao reproduzir música.').catch(() => {});
  });

// CARREGAR COMANDOS
const commandsPath = path.join(__dirname, 'commands');
let commandsJson = [];

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const mod = require(path.join(commandsPath, file));
    const list = Array.isArray(mod) ? mod : [mod];

    for (const cmd of list) {
      if (!cmd?.data || !cmd?.execute) continue;

      client.commands.set(cmd.data.name, cmd);
      commandsJson.push(cmd.data.toJSON());
    }
  }
} else {
  console.log('⚠ Pasta commands não encontrada');
}

// STATUS
const activities = [
  { name: '/tocar para começar', type: ActivityType.Playing },
  { name: 'Ouvindo o servidor', type: ActivityType.Listening },
  { name: 'Voxara Music Bot', type: ActivityType.Watching }
];

function rotateActivity() {
  if (!client.user) return;

  const act = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(act.name, { type: act.type });
}

// READY
client.once('clientReady', async () => {
  console.log('\n══════════════════════════════');
  console.log('VOXARA BOT ONLINE');
  console.log('Bot:', client.user.tag);
  console.log('Servidores:', client.guilds.cache.size);
  console.log('══════════════════════════════\n');

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commandsJson });

    console.log(`✅ ${commandsJson.length} comandos registrados`);
  } catch (err) {
    console.error('Erro registrar comandos:', err);
  }

  rotateActivity();
  setInterval(rotateActivity, 30000);
});

// INTERAÇÕES
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}`, error);

    const msg = {
      content: '❌ Erro ao executar comando.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
=======
﻿require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

client.distube = new DisTube(client, {
  plugins: [new YtDlpPlugin()],
  emitNewSongOnly: true
});

client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel?.send(
      `🎵 **Tocando agora:**` + '\n' +
      `> **${song.name}**` + '\n' +
      `> 👤 ${song.user?.displayName || 'Usuário'} | ⏱️ ${song.formattedDuration}`
    ).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    queue.textChannel?.send(
      `✅ **${song.name}** adicionada à fila!` + '\n' +
      `> ⏱️ ${song.formattedDuration} | 📋 Posição: ${queue.songs.length}`
    ).catch(() => {});
  })
  .on('finish', queue => {
    queue.textChannel?.send('✅ Fila finalizada!').catch(() => {});
  })
  .on('disconnect', queue => {
    queue.textChannel?.send('🔌 Voxara desconectado.').catch(() => {});
  })
  .on('error', (channel, error) => {
    console.error('DisTube erro:', error);
    channel?.send('❌ Erro ao reproduzir música.').catch(() => {});
  });

const commandsPath = path.join(__dirname, 'commands');
let commandsJson = [];

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const mod = require(path.join(commandsPath, file));
    const list = Array.isArray(mod) ? mod : [mod];

    for (const cmd of list) {
      if (!cmd?.data || !cmd?.execute) continue;
      client.commands.set(cmd.data.name, cmd);
      commandsJson.push(cmd.data.toJSON());
    }
  }
} else {
  console.log('⚠ Pasta commands não encontrada');
}

const activities = [
  { name: '/tocar para começar', type: ActivityType.Playing },
  { name: 'Ouvindo o servidor', type: ActivityType.Listening },
  { name: 'Voxara Music Bot', type: ActivityType.Watching }
];

function rotateActivity() {
  if (!client.user) return;
  const act = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(act.name, { type: act.type });
}

client.once('clientReady', async () => {
  console.log('\n══════════════════════════════');
  console.log('VOXARA BOT ONLINE');
  console.log('Bot:', client.user.tag);
  console.log('Servidores:', client.guilds.cache.size);
  console.log('══════════════════════════════\n');

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commandsJson });
    console.log(`✅ ${commandsJson.length} comandos registrados`);
  } catch (err) {
    console.error('Erro registrar comandos:', err);
  }

  rotateActivity();
  setInterval(rotateActivity, 30000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}`, error);

    const msg = {
      content: '❌ Erro ao executar comando.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
>>>>>>> aa07c47 (voxara v3 distube)
