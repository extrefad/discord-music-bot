require('dotenv').config();

class Config {
  constructor() {
    this.discordToken =
      process.env.DISCORD_TOKEN ||
      process.env.TOKEN ||
      process.env.BOT_TOKEN ||
      '';

    this.clientId =
      process.env.CLIENT_ID ||
      process.env.APPLICATION_ID ||
      process.env.APP_ID ||
      '';

    this.guildId = process.env.GUILD_ID || '';
    this.prefix = process.env.PREFIX || '/';
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY || '';
    this.youtubeCookies = process.env.YOUTUBE_COOKIES || '';
    this.youtubeCookiesFile = process.env.YOUTUBE_COOKIES_FILE || '';
    this.leaveOnEmptyCooldownMs = Number(process.env.LEAVE_ON_EMPTY_COOLDOWN_MS || 120000);
  }

  validate() {
    const missing = [];

    if (!this.discordToken) missing.push('DISCORD_TOKEN');
    if (!this.clientId) missing.push('CLIENT_ID');

    if (missing.length) {
      throw new Error(
        `Variáveis obrigatórias ausentes: ${missing.join(', ')}. ` +
          'Crie um arquivo .env na raiz com DISCORD_TOKEN=... e CLIENT_ID=...'
      );
    }
  }
}

module.exports = { Config };
