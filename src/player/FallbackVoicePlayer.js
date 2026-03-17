const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');

class FallbackVoicePlayer {
  constructor({ logger }) {
    this.logger = logger;
    this.guildStates = new Map();
  }

  sanitizeQuery(rawQuery) {
    let query = String(rawQuery || '').trim();

    if (query.startsWith('<') && query.endsWith('>')) {
      query = query.slice(1, -1).trim();
    }

    if (/^(www\.)?youtube\.com\//i.test(query) || /^youtu\.be\//i.test(query)) {
      query = `https://${query.replace(/^https?:\/\//i, '')}`;
    }

    return query;
  }

  getOrCreateState(guildId) {
    if (!this.guildStates.has(guildId)) {
      this.guildStates.set(guildId, {
        connection: null,
        player: null,
        resource: null,
        queue: [],
        current: null,
        paused: false,
        volume: 100,
        loopMode: 'desativado',
      });
    }
    return this.guildStates.get(guildId);
  }

  normalizeResolvedTrack(track, requestedBy) {
    const url = track?.url || (track?.id ? `https://www.youtube.com/watch?v=${track.id}` : null);

    if (!url) {
      throw new Error('Falha ao resolver URL da música.');
    }

    return {
      url,
      name: track?.title || 'Desconhecido',
      formattedDuration: track?.durationRaw || 'Ao vivo',
      thumbnail: track?.thumbnails?.[0]?.url,
      user: requestedBy,
    };
  }

  async resolveTrack(query, requestedBy) {
    const cleanedQuery = this.sanitizeQuery(query);

    if (!cleanedQuery) throw new Error('Busca vazia.');

    if (play.yt_validate(cleanedQuery) === 'video') {
      try {
        const info = await play.video_basic_info(cleanedQuery);
        const details = info?.video_details;
        return this.normalizeResolvedTrack(details, requestedBy);
      } catch (error) {
        this.logger.warn('Falha em video_basic_info, tentando busca fallback', {
          query: cleanedQuery,
          error: error?.message || 'Erro desconhecido',
        });
      }
    }

    const results = await play.search(cleanedQuery, { limit: 1, source: { youtube: 'video' } });
    const first = results?.[0];
    if (!first) throw new Error('Nenhum resultado encontrado no play-dl.');

    return this.normalizeResolvedTrack(first, requestedBy);
  }

  async ensureConnection(guildId, voiceChannel) {
    const state = this.getOrCreateState(guildId);

    if (!state.connection) {
      state.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      await entersState(state.connection, VoiceConnectionStatus.Ready, 30_000);
    }

    if (!state.player) {
      state.player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      state.player.on(AudioPlayerStatus.Idle, async () => {
        await this.handleTrackFinish(guildId);
      });

      state.player.on('error', (error) => {
        this.logger.error('Erro no player play-dl', { guildId, error: error.message });
        this.stop(guildId);
      });

      state.connection.subscribe(state.player);
    }

    return state;
  }

  async enqueue({ guildId, voiceChannel, query, requestedBy }) {
    const state = await this.ensureConnection(guildId, voiceChannel);
    const track = await this.resolveTrack(query, requestedBy);

    state.queue.push(track);
    const position = state.queue.length;

    if (!state.current) {
      await this.playNext(guildId);
      return { track, nowPlaying: true, position: 1 };
    }

    return { track, nowPlaying: false, position };
  }

  async playNext(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state || !state.queue.length) {
      this.stop(guildId);
      return false;
    }

    const nextTrack = state.queue[0];
    const stream = await play.stream(nextTrack.url, { quality: 2, discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(Math.max(0, Math.min(2, state.volume / 100)));

    state.resource = resource;
    state.current = nextTrack;
    state.paused = false;
    state.player.play(resource);

    this.logger.music('Tocando via play-dl', { guildId, title: nextTrack.name, url: nextTrack.url });
    return true;
  }

  async handleTrackFinish(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state || !state.current) return;

    const finished = state.queue.shift();

    if (state.loopMode === 'musica' && finished) {
      state.queue.unshift(finished);
    } else if (state.loopMode === 'fila' && finished) {
      state.queue.push(finished);
    }

    state.current = null;

    if (!state.queue.length) {
      this.stop(guildId);
      return;
    }

    try {
      await this.playNext(guildId);
    } catch (error) {
      this.logger.error('Falha ao tocar próxima via play-dl', { guildId, error: error.message });
      this.stop(guildId);
    }
  }

  has(guildId) {
    const state = this.guildStates.get(guildId);
    return Boolean(state && (state.current || state.queue.length));
  }

  getNowPlaying(guildId) {
    return this.guildStates.get(guildId)?.current || null;
  }

  pause(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state?.player || !state.current) return false;
    state.player.pause();
    state.paused = true;
    return true;
  }

  resume(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state?.player || !state.current) return false;
    state.player.unpause();
    state.paused = false;
    return true;
  }

  skip(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state?.player || !state.current) return false;
    state.player.stop();
    return true;
  }

  stop(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;

    try {
      state.player?.stop();
      state.connection?.destroy();
    } catch {
      // noop
    }

    this.guildStates.delete(guildId);
    return true;
  }

  setVolume(guildId, volume) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;
    state.volume = volume;
    state.resource?.volume?.setVolume(Math.max(0, Math.min(2, volume / 100)));
    return true;
  }

  setLoop(guildId, mode) {
    const state = this.guildStates.get(guildId);
    if (!state || (!state.current && !state.queue.length)) return null;
    state.loopMode = mode;
    return mode;
  }

  getQueueSummary(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state || (!state.current && !state.queue.length)) return null;

    const songs = state.current ? [state.current, ...state.queue.slice(1)] : [...state.queue];

    return {
      volume: state.volume,
      paused: state.paused,
      repeatMode: state.loopMode,
      autoplay: false,
      songs,
    };
  }
}

module.exports = { FallbackVoicePlayer };
