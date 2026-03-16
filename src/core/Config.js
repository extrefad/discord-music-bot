require('dotenv').config();

class Config {
  constructor() {
    this.discordToken = process.env.DISCORD_TOKEN || '';
    this.clientId = process.env.CLIENT_ID || '';
    this.guildId = process.env.GUILD_ID || '';
    this.prefix = process.env.PREFIX || '/';
    this.leaveOnEmptyCooldownMs = Number(process.env.LEAVE_ON_EMPTY_COOLDOWN_MS || 120000);
  }

  validate() {
    const required = ['discordToken', 'clientId'];
    const missing = required.filter((key) => !this[key]);
    if (missing.length) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

module.exports = { Config };
