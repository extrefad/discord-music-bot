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

  async resolveTrack(query) {
    if (play.yt_validate(query) === 'video') {
      const info = await play.video_info(query);
      return {
        url: info.video_details.url,
        title: info.video_details.title,
        durationRaw: info.video_details.durationRaw || 'Ao vivo',
        thumbnail: info.video_details.thumbnails?.[0]?.url,
      };
    }

    const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });
    const first = results?.[0];
    if (!first) throw new Error('Nenhum resultado encontrado no fallback play-dl.');

    return {
      url: first.url,
      title: first.title,
      durationRaw: first.durationRaw || 'Ao vivo',
      thumbnail: first.thumbnails?.[0]?.url,
    };
  }

  async play({ guildId, voiceChannel, query, requestedBy }) {
    const track = await this.resolveTrack(query);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const stream = await play.stream(track.url, { quality: 2, discordPlayerCompatibility: true });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Arbitrary,
      inlineVolume: true,
    });

    resource.volume?.setVolume(1);

    player.play(resource);
    connection.subscribe(player);

    const cleanup = () => {
      const state = this.guildStates.get(guildId);
      if (!state) return;
      state.connection.destroy();
      this.guildStates.delete(guildId);
    };

    player.once(AudioPlayerStatus.Idle, cleanup);
    player.on('error', (error) => {
      this.logger.error('Erro no fallback play-dl', { guildId, error: error.message });
      cleanup();
    });

    this.guildStates.set(guildId, {
      connection,
      player,
      resource,
      track: {
        name: track.title,
        url: track.url,
        formattedDuration: track.durationRaw,
        thumbnail: track.thumbnail,
        user: requestedBy,
      },
      paused: false,
      volume: 100,
    });

    this.logger.warn('Modo fallback ativado (play-dl)', { guildId, title: track.title, url: track.url });
    return track;
  }

  has(guildId) {
    return this.guildStates.has(guildId);
  }

  getNowPlaying(guildId) {
    return this.guildStates.get(guildId)?.track || null;
  }

  pause(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;
    state.player.pause();
    state.paused = true;
    return true;
  }

  resume(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;
    state.player.unpause();
    state.paused = false;
    return true;
  }

  stop(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;
    state.player.stop();
    state.connection.destroy();
    this.guildStates.delete(guildId);
    return true;
  }

  setVolume(guildId, volume) {
    const state = this.guildStates.get(guildId);
    if (!state) return false;
    state.resource.volume?.setVolume(Math.max(0, Math.min(2, volume / 100)));
    state.volume = volume;
    return true;
  }

  getQueueSummary(guildId) {
    const state = this.guildStates.get(guildId);
    if (!state) return null;

    return {
      volume: state.volume,
      paused: state.paused,
      repeatMode: 'desativado',
      autoplay: false,
      songs: [state.track],
    };
  }
}

module.exports = { FallbackVoicePlayer };
