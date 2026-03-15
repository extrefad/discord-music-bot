require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
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
client.musicQueues = new Map();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const mod = require(path.join(commandsPath, file));
  const list = Array.isArray(mod) ? mod : [mod];
  for (const command of list) {
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Comando carregado: /${command.data.name}`);
    }
  }
}

client.once('ready', () => {
  console.log(`\n🤖 Bot online como ${client.user.tag}`);
  console.log(`🎵 Pronto para tocar músicas!`);
  console.log(`🎤 Reconhecimento de voz ativo\n`);
  client.user.setActivity('🎵 /tocar | 🎤 voz', { type: 2 });
});

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
