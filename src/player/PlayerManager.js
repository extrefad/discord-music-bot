const { RepeatMode } = require('distube');
const { QueueManager } = require('./QueueManager');
const { SearchManager } = require('./SearchManager');
const { FallbackVoicePlayer } = require('./FallbackVoicePlayer');

class PlayerManager {
  constructor({ distube, logger, config }) {
    this.distube = distube;
    this.logger = logger;
    this.config = config;
    this.queues = new QueueManager(distube);
    this.fallback = new FallbackVoicePlayer({ logger });
  }

  async play({ voiceChannel, textChannel, member, query }) {
    const normalized = SearchManager.normalizeQuery(query);
    const source = SearchManager.detectSource(normalized);
    const resolved = await SearchManager.resolveQuery(normalized, this.config, this.logger);

    const attempts = [resolved];

    if (source === 'search' && !/^ytsearch:/i.test(resolved)) {
      attempts.push(`ytsearch:${normalized}`);
    }

    if (source === 'youtube' && /^https?:\/\//i.test(resolved)) {
      attempts.push(resolved.replace(/^https?:\/\/(www\.)?/i, ''));
    }

    if (source === 'youtube') {
      const idMatch = resolved.match(/[?&]v=([^&]+)/) || resolved.match(/youtu\.be\/([^?&]+)/);
      if (idMatch?.[1]) {
        attempts.push(`ytsearch:${idMatch[1]}`);
      }
    }

    let lastError = null;

    for (const attempt of [...new Set(attempts)]) {
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

        return { ...this.queues.getSummary(voiceChannel.guild.id), mode: 'distube' };
      } catch (error) {
        lastError = error;
        this.logger.warn('Tentativa de reprodução falhou', {
          attempt,
          guildId: voiceChannel.guild.id,
          error: error?.message || 'Erro desconhecido',
        });
      }
    }

    this.logger.warn('Ativando modo contingência com play-dl', {
      guildId: voiceChannel.guild.id,
      query: normalized,
      reason: lastError?.message || 'erro desconhecido',
    });

    const track = await this.fallback.play({
      guildId: voiceChannel.guild.id,
      voiceChannel,
      query: normalized,
      requestedBy: member.user,
    });

    return {
      mode: 'fallback',
      songs: [{
        name: track.title,
        url: track.url,
        formattedDuration: track.durationRaw,
      }],
    };
  }

  pause(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      queue.pause();
      return true;
    }
    return this.fallback.pause(guildId);
  }

  resume(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      queue.resume();
      return true;
    }
    return this.fallback.resume(guildId);
  }

  skip(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      queue.skip();
      return true;
    }
    return this.fallback.stop(guildId);
  }

  stop(guildId) {
    const stoppedDisTube = this.queues.clear(guildId);
    const stoppedFallback = this.fallback.stop(guildId);
    return stoppedDisTube || stoppedFallback;
  }

  disconnect(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      queue.voice?.leave();
      queue.stop();
      return true;
    }
    return this.fallback.stop(guildId);
  }

  setVolume(guildId, volume) {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      queue.setVolume(volume);
      return true;
    }
    return this.fallback.setVolume(guildId, volume);
  }

  setLoop(guildId, mode) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return this.fallback.has(guildId) ? 0 : null;
    const repeatMode = mode === 'desativado' ? RepeatMode.DISABLED : mode === 'musica' ? RepeatMode.SONG : RepeatMode.QUEUE;
    return queue.setRepeatMode(repeatMode);
  }

  shuffle(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    return this.queues.shuffle(guildId);
  }

  getQueue(guildId) {
    return this.queues.getSummary(guildId) || this.fallback.getQueueSummary(guildId);
  }

  getNowPlaying(guildId) {
    const queue = this.distube.getQueue(guildId);
    return queue?.songs?.[0] || this.fallback.getNowPlaying(guildId) || null;
  }
}

module.exports = { PlayerManager };
