const { RepeatMode } = require('distube');
const { QueueManager } = require('./QueueManager');
const { SearchManager } = require('./SearchManager');

class PlayerManager {
  constructor({ distube, logger, config }) {
    this.distube = distube;
    this.logger = logger;
    this.config = config;
    this.queues = new QueueManager(distube);
  }

  async play({ voiceChannel, textChannel, member, query }) {
    const normalized = SearchManager.normalizeQuery(query);
    await this.distube.play(voiceChannel, normalized, {
      textChannel,
      member,
      metadata: { requestedBy: member.user.tag, source: SearchManager.detectSource(normalized) },
    });

    return this.queues.getSummary(voiceChannel.guild.id);
  }

  pause(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    queue.pause();
    return true;
  }

  resume(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    queue.resume();
    return true;
  }

  skip(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    queue.skip();
    return true;
  }

  stop(guildId) {
    return this.queues.clear(guildId);
  }

  disconnect(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    queue.voice?.leave();
    queue.stop();
    return true;
  }

  setVolume(guildId, volume) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    queue.setVolume(volume);
    return true;
  }

  setLoop(guildId, mode) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return null;
    const repeatMode = mode === 'off' ? RepeatMode.DISABLED : mode === 'song' ? RepeatMode.SONG : RepeatMode.QUEUE;
    const result = queue.setRepeatMode(repeatMode);
    return result;
  }

  shuffle(guildId) {
    return this.queues.shuffle(guildId);
  }

  getQueue(guildId) {
    return this.queues.getSummary(guildId);
  }

  getNowPlaying(guildId) {
    const queue = this.distube.getQueue(guildId);
    return queue?.songs?.[0] || null;
  }
}

module.exports = { PlayerManager };
