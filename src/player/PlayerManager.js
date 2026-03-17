const { FallbackVoicePlayer } = require('./FallbackVoicePlayer');

class PlayerManager {
  constructor({ logger, config }) {
    this.logger = logger;
    this.fallback = new FallbackVoicePlayer({ logger, config });
  }

  async play({ voiceChannel, member, query }) {
    const result = await this.fallback.enqueue({
      guildId: voiceChannel.guild.id,
      voiceChannel,
      query,
      requestedBy: member.user,
    });

    return {
      mode: 'play-dl-primary',
      nowPlaying: result.nowPlaying,
      position: result.position,
      track: result.track,
      songs: this.fallback.getQueueSummary(voiceChannel.guild.id)?.songs || [result.track],
    };
  }

  pause(guildId) {
    return this.fallback.pause(guildId);
  }

  resume(guildId) {
    return this.fallback.resume(guildId);
  }

  skip(guildId) {
    return this.fallback.skip(guildId);
  }

  stop(guildId) {
    return this.fallback.stop(guildId);
  }

  disconnect(guildId) {
    return this.fallback.stop(guildId);
  }

  setVolume(guildId, volume) {
    return this.fallback.setVolume(guildId, volume);
  }

  setLoop(guildId, mode) {
    return this.fallback.setLoop(guildId, mode);
  }

  shuffle(guildId) {
    const queue = this.fallback.getQueueSummary(guildId);
    if (!queue || queue.songs.length <= 2) return false;

    const [current, ...rest] = queue.songs;
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    const state = this.fallback.guildStates.get(guildId);
    if (!state) return false;
    state.queue = [current, ...rest];
    return true;
  }

  getQueue(guildId) {
    return this.fallback.getQueueSummary(guildId);
  }

  getNowPlaying(guildId) {
    return this.fallback.getNowPlaying(guildId);
  }
}

module.exports = { PlayerManager };
