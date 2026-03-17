class CooldownManager {
  constructor() {
    this.cooldowns = new Map();
  }

  getKey(commandName, userId, guildId) {
    return `${guildId}:${userId}:${commandName}`;
  }

  hit(commandName, userId, guildId, cooldownMs) {
    if (!cooldownMs || cooldownMs <= 0) return { allowed: true, retryAfterMs: 0 };
    const key = this.getKey(commandName, userId, guildId);
    const now = Date.now();
    const last = this.cooldowns.get(key) || 0;
    const diff = now - last;

    if (diff < cooldownMs) {
      return { allowed: false, retryAfterMs: cooldownMs - diff };
    }

    this.cooldowns.set(key, now);
    return { allowed: true, retryAfterMs: 0 };
  }
}

module.exports = { CooldownManager };
