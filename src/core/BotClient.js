const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require('discord.js');
const { CooldownManager } = require('../utils/CooldownManager');
const { PlayerManager } = require('../player/PlayerManager');

class BotClient extends Client {
  constructor({ config, logger }) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    this.config = config;
    this.logger = logger;
    this.commands = new Collection();
    this.cooldowns = new CooldownManager();

    this.player = new PlayerManager({
      logger: this.logger.child('PLAYER'),
      config,
    });
  }

  async init() {
    await this.loadCommands(path.join(__dirname, '..', 'commands'));
    await this.loadEvents(path.join(__dirname, '..', 'events'));
    await this.registerSlashCommands();

    this.attachProcessHandlers();
    await this.login(this.config.discordToken);
  }

  getJavaScriptFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return this.getJavaScriptFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_')) return [fullPath];
      return [];
    });
  }

  async loadCommands(commandsRoot) {
    const files = this.getJavaScriptFiles(commandsRoot);
    for (const filePath of files) {
      const command = require(filePath);
      if (!command?.data || !command?.execute) {
        this.logger.warn('Comando inválido ignorado', { filePath });
        continue;
      }
      this.commands.set(command.data.name, command);
      this.logger.info('Comando carregado', { command: command.data.name });
    }
  }

  async loadEvents(eventsRoot) {
    const files = this.getJavaScriptFiles(eventsRoot);
    for (const filePath of files) {
      const event = require(filePath);
      if (!event?.name || !event?.execute) {
        this.logger.warn('Evento inválido ignorado', { filePath });
        continue;
      }

      const wrapped = (...args) => event.execute(...args, this);
      if (event.once) this.once(event.name, wrapped);
      else this.on(event.name, wrapped);

      this.logger.info('Evento carregado', { event: event.name });
    }
  }

  async registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(this.config.discordToken);
    const body = [...this.commands.values()].map((command) => command.data.toJSON());
    const route = this.config.guildId
      ? Routes.applicationGuildCommands(this.config.clientId, this.config.guildId)
      : Routes.applicationCommands(this.config.clientId);

    await rest.put(route, { body });
    this.logger.info('Slash commands registrados', { total: body.length, scope: this.config.guildId ? 'guild' : 'global' });
  }

  attachProcessHandlers() {
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', { reason: String(reason) });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    });
  }
}

module.exports = { BotClient };
