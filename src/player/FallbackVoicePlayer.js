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
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    this.guildStates = new Map();
  }

  sanitizeQuery(rawQuery) {
    let query = String(rawQuery || '').trim();

    if (query.startsWith('<') && query.endsWith('>')) {
      query = query.slice(1, -1).trim();
    }

    query = this.extractUrlFromText(query);

    if (/^(www\.)?youtube\.com\//i.test(query) || /^youtu\.be\//i.test(query) || /^(open\.)?spotify\.com\//i.test(query) || /^soundcloud\.com\//i.test(query)) {
      query = `https://${query.replace(/^https?:\/\//i, '')}`;
    }

    return query;
  }

  extractUrlFromText(text) {
    const markdownMatch = text.match(/\((https?:\/\/[^)\s]+)\)/i);
    if (markdownMatch?.[1]) return markdownMatch[1];

    const plainMatch = text.match(/https?:\/\/\S+/i);
    if (plainMatch?.[0]) return plainMatch[0];

    return text;
  }

  normalizePlayableUrl(rawUrl) {
    if (!rawUrl) return null;
    let candidate = String(rawUrl).trim();

    if (/^(www\.)?youtube\.com\//i.test(candidate) || /^youtu\.be\//i.test(candidate)) {
      candidate = `https://${candidate.replace(/^https?:\/\//i, '')}`;
    }

    try {
      const parsed = new URL(candidate);
      if (!/^https?:$/.test(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  isLikelyYoutubeId(input) {
    return /^[a-zA-Z0-9_-]{11}$/.test(input);
  }

  extractYoutubeId(input) {
    const match = String(input || '').match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/i);
    return match?.[1] || null;
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

  normalizeResolvedTrack(track, requestedBy, source = 'busca') {
    const rawUrl = track?.url || (track?.id ? `https://www.youtube.com/watch?v=${track.id}` : null);
    const url = this.normalizePlayableUrl(rawUrl);

    if (!url) {
      throw new Error('Falha ao resolver URL da música.');
    }

    return {
      url,
      name: track?.title || track?.name || 'Desconhecido',
      formattedDuration: track?.durationRaw || 'Ao vivo',
      thumbnail: track?.thumbnails?.[0]?.url,
      user: requestedBy,
      source,
    };
  }

  async resolveFromYouTubeUrl(url, requestedBy) {
    const info = await play.video_basic_info(url);
    return this.normalizeResolvedTrack(info?.video_details, requestedBy, 'youtube');
  }

  async resolveFromTextSearch(term, requestedBy, source = 'busca') {
    const results = await play.search(term, { limit: 1, source: { youtube: 'video' } });
    const first = results?.[0];
    if (!first) throw new Error('Nenhum resultado encontrado na busca.');
    return this.normalizeResolvedTrack(first, requestedBy, source);
  }

  async resolveSpotifyInput(url, requestedBy) {
    const validated = play.sp_validate(url);
    if (!validated) throw new Error('Link do Spotify inválido.');

    const spotifyObject = await play.spotify(url);

    if (validated === 'track') {
      const term = `${spotifyObject.name} ${spotifyObject.artists?.map((a) => a.name).join(' ')}`;
      return [await this.resolveFromTextSearch(term, requestedBy, 'spotify')];
    }

    const tracks = await spotifyObject.fetch();
    const list = Array.isArray(tracks) ? tracks : spotifyObject.all_tracks || [];
    const limited = list.slice(0, 50);

    const resolved = [];
    for (const item of limited) {
      const term = `${item.name} ${item.artists?.map((a) => a.name).join(' ')}`;
      try {
        resolved.push(await this.resolveFromTextSearch(term, requestedBy, 'spotify'));
      } catch (error) {
        this.logger.warn('Falha ao resolver faixa do Spotify', { term, error: error.message });
      }
    }

    if (!resolved.length) throw new Error('Não foi possível resolver faixas do Spotify.');
    return resolved;
  }

  async resolveSoundCloudInput(url, requestedBy) {
    const soType = await play.so_validate(url);
    if (!soType) throw new Error('Link do SoundCloud inválido.');

    const scObject = await play.soundcloud(url);

    if (soType === 'track') {
      return [this.normalizeResolvedTrack(scObject, requestedBy, 'soundcloud')];
    }

    const tracks = scObject?.tracks || [];
    const limited = tracks.slice(0, 50).map((track) => this.normalizeResolvedTrack(track, requestedBy, 'soundcloud'));
    if (!limited.length) throw new Error('Playlist do SoundCloud sem faixas válidas.');
    return limited;
  }

  async resolveInput(query, requestedBy) {
    const cleaned = this.sanitizeQuery(query);
    if (!cleaned) throw new Error('Busca vazia.');

    const youtubeId = this.isLikelyYoutubeId(cleaned) ? cleaned : this.extractYoutubeId(cleaned);
    if (youtubeId) {
      const track = await this.resolveFromYouTubeUrl(`https://www.youtube.com/watch?v=${youtubeId}`, requestedBy);
      return { tracks: [track], sourceMessage: 'Reproduzindo via YouTube' };
    }

    const normalizedUrl = this.normalizePlayableUrl(cleaned);

    if (normalizedUrl) {
      let validation = null;
      try {
        validation = await play.validate(normalizedUrl);
      } catch (error) {
        this.logger.warn('Falha ao validar URL, tentando como busca', {
          url: normalizedUrl,
          error: error.message,
        });
      }

      if (validation?.startsWith('yt_')) {
        if (validation === 'yt_playlist') {
          const playlist = await play.playlist_info(normalizedUrl, { incomplete: true });
          const videos = playlist?.videos?.slice(0, 50) || [];
          const tracks = videos.map((video) => this.normalizeResolvedTrack(video, requestedBy, 'youtube'));
          if (!tracks.length) throw new Error('Playlist do YouTube sem faixas válidas.');
          return { tracks, sourceMessage: 'Reproduzindo via YouTube' };
        }

        const track = await this.resolveFromYouTubeUrl(normalizedUrl, requestedBy);
        return { tracks: [track], sourceMessage: 'Reproduzindo via YouTube' };
      }

      if (validation?.startsWith('sp_')) {
        const tracks = await this.resolveSpotifyInput(normalizedUrl, requestedBy);
        return { tracks, sourceMessage: 'Reproduzindo via Spotify' };
      }

      if (validation?.startsWith('so_')) {
        const tracks = await this.resolveSoundCloudInput(normalizedUrl, requestedBy);
        return { tracks, sourceMessage: 'Reproduzindo via SoundCloud' };
      }

      const track = await this.resolveFromTextSearch(normalizedUrl, requestedBy, 'busca');
      return { tracks: [track], sourceMessage: 'Reproduzindo via busca' };
    }

    const track = await this.resolveFromTextSearch(cleaned, requestedBy, 'busca');
    return { tracks: [track], sourceMessage: 'Reproduzindo via busca' };
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
    const { tracks, sourceMessage } = await this.resolveInput(query, requestedBy);

    const firstTrack = tracks[0];
    for (const track of tracks) state.queue.push(track);

    const position = state.queue.length - tracks.length + 1;

    if (!state.current) {
      await this.playNext(guildId);
      return { track: firstTrack, nowPlaying: true, position: 1, sourceMessage, addedCount: tracks.length };
    }

    return { track: firstTrack, nowPlaying: false, position, sourceMessage, addedCount: tracks.length };
  }

  async playNext(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state || !state.queue.length) {
      this.stop(guildId);
      return false;
    }

    const nextTrack = state.queue[0];
    const playableUrl = this.normalizePlayableUrl(nextTrack.url);
    if (!playableUrl) {
      throw new Error('URL inválida para reprodução.');
    }

    const stream = await play.stream(playableUrl, { quality: 2, discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(Math.max(0, Math.min(2, state.volume / 100)));

    state.resource = resource;
    state.current = nextTrack;
    state.paused = false;
    state.player.play(resource);

    this.logger.music('Tocando via play-dl', { guildId, title: nextTrack.name, url: playableUrl, source: nextTrack.source });
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
