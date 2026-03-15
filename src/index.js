require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { REST, Routes } = require('discord.js');
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

client.commands    = new Collection();
client.musicQueues = new Map();

// ─── Carrega comandos ──────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsJson = [];

for (const file of commandFiles) {
  const mod  = require(path.join(commandsPath, file));
  const list = Array.isArray(mod) ? mod : [mod];
  for (const command of list) {
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commandsJson.push(command.data.toJSON());
      console.log(`✅ Comando carregado: /${command.data.name}`);
    }
  }
}

// ─── Atividades rotativas ──────────────────────────────────────────────────────
const activities = [
  { name: '🎵 Diga "música tocar..."',   type: ActivityType.Playing   },
  { name: '🔊 Ouvindo o servidor',       type: ActivityType.Listening },
  { name: '🎤 Reconhecimento de voz ON', type: ActivityType.Watching  },
  { name: '/tocar para começar',         type: ActivityType.Playing   },
];

function rotateActivity() {
  const act = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(act.name, { type: act.type });
}

// ─── Ready ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   🎙️  VOXARA está online!             ║`);
  console.log(`║   Bot: ${client.user.tag.padEnd(28)}║`);
  console.log(`║   Servidores: ${String(client.guilds.cache.size).padEnd(23)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // Registra slash commands automaticamente
  try {
    const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commandsJson });
    console.log(`✅ ${commandsJson.length} comandos registrados no Discord!`);
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err.message);
  }

  // Ativa rotação de status a cada 30s
  rotateActivity();
  setInterval(rotateActivity, 30_000);
});

// ─── Interações ────────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}:`, error);
    const msg = { content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);