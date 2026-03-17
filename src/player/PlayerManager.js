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
    const source = SearchManager.detectSource(normalized);

    const attempts = [normalized];

    if (source === 'search' && !/^ytsearch:/i.test(normalized)) {
      attempts.push(`ytsearch:${normalized}`);
    }

    if (source === 'youtube' && /^https?:\/\//i.test(normalized)) {
      attempts.push(normalized.replace(/^https?:\/\/(www\.)?/i, ''));
    }

    if (source === 'youtube') {
      const idMatch = normalized.match(/[?&]v=([^&]+)/) || normalized.match(/youtu\.be\/([^?&]+)/);
      if (idMatch?.[1]) {
        attempts.push(`ytsearch:${idMatch[1]}`);
      }
    }

    let lastError = null;

    for (const attempt of attempts) {
      try {
        await this.distube.play(voiceChannel, attempt, {
          textChannel,
          member,
          metadata: { requestedBy: member.user.tag, source },
        });

        if (attempt !== normalized) {
          this.logger.warn('Fallback de reprodução aplicado com sucesso', {
            original: normalized,
            fallback: attempt,
            guildId: voiceChannel.guild.id,
          });
        }

        return this.queues.getSummary(voiceChannel.guild.id);
      } catch (error) {
        lastError = error;
        this.logger.warn('Tentativa de reprodução falhou', {
          attempt,
          guildId: voiceChannel.guild.id,
          error: error?.message || 'Erro desconhecido',
        });
      }
    }

    throw lastError || new Error('Falha ao reproduzir música.');
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
    const repeatMode = mode === 'desativado' ? RepeatMode.DISABLED : mode === 'musica' ? RepeatMode.SONG : RepeatMode.QUEUE;
    return queue.setRepeatMode(repeatMode);
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
