const fs = require('fs');
const path = require('path');
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

class LocalMusicPlayer {
  constructor(options = {}) {
    this.musicDir = options.musicDir;
    this.guildStates = new Map();
    ensureDir(this.musicDir);
  }

  getLibrary() {
    const files = fs.readdirSync(this.musicDir, { withFileTypes: true });
    return files
      .filter((file) => file.isFile())
      .map((file) => file.name)
      .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  resolveTrack(query) {
    const library = this.getLibrary();
    const loweredQuery = query.toLowerCase();

    const exact = library.find((name) => name.toLowerCase() === loweredQuery);
    if (exact) return { fileName: exact, filePath: path.join(this.musicDir, exact) };

    const partial = library.find((name) => name.toLowerCase().includes(loweredQuery));
    if (partial) return { fileName: partial, filePath: path.join(this.musicDir, partial) };

    return null;
  }

  getState(guildId) {
    if (!this.guildStates.has(guildId)) {
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      const state = {
        queue: [],
        current: null,
        connection: null,
        player,
        textChannel: null,
        loopMode: 'off',
        volume: 80,
      };

      player.on(AudioPlayerStatus.Idle, () => {
        this.advanceQueue(guildId).catch((error) => {
          console.error('Erro ao avançar fila:', error);
        });
      });

      player.on('error', (error) => {
        console.error('Erro no audio player:', error.message);
      });

      this.guildStates.set(guildId, state);
    }

    return this.guildStates.get(guildId);
  }

  async connectToVoiceChannel(voiceChannel) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    return connection;
  }

  async enqueue({ guildId, voiceChannel, textChannel, query, requestedBy }) {
    const track = this.resolveTrack(query);
    if (!track) return { ok: false, reason: 'not_found' };

    const state = this.getState(guildId);
    if (!state.connection || state.connection.joinConfig.channelId !== voiceChannel.id) {
      if (state.connection) state.connection.destroy();
      state.connection = await this.connectToVoiceChannel(voiceChannel);
      state.connection.subscribe(state.player);
    }

    state.textChannel = textChannel;
    const queueItem = { ...track, requestedBy };
    state.queue.push(queueItem);

    if (!state.current) {
      await this.playNext(guildId);
      return { ok: true, nowPlaying: true, track: queueItem };
    }

    return { ok: true, nowPlaying: false, track: queueItem, position: state.queue.length };
  }

  async playNext(guildId) {
    const state = this.getState(guildId);
    if (state.queue.length === 0) {
      state.current = null;
      return;
    }

    const next = state.queue[0];
    state.current = next;

    const resource = createAudioResource(next.filePath, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });

    resource.volume.setVolume(state.volume / 100);
    state.player.play(resource);

    if (state.textChannel) {
      await state.textChannel.send(
        `🎵 **Tocando agora:** **${next.fileName}**\n> 👤 Pedido por: ${next.requestedBy}`
      );
    }
  }

  async advanceQueue(guildId) {
    const state = this.getState(guildId);
    if (!state.current) return;

    if (state.loopMode === 'track') {
      await this.playNext(guildId);
      return;
    }

    const finished = state.queue.shift();

    if (state.loopMode === 'queue' && finished) {
      state.queue.push(finished);
    }

    if (state.queue.length === 0) {
      state.current = null;
      if (state.textChannel) {
        await state.textChannel.send('✅ Fila finalizada.');
      }
      return;
    }

    await this.playNext(guildId);
  }

  getQueue(guildId) {
    return this.getState(guildId).queue;
  }

  getCurrent(guildId) {
    return this.getState(guildId).current;
  }

  togglePause(guildId) {
    const state = this.getState(guildId);
    if (!state.current) return { ok: false };

    if (state.player.state.status === AudioPlayerStatus.Paused) {
      state.player.unpause();
      return { ok: true, paused: false };
    }

    state.player.pause();
    return { ok: true, paused: true };
  }

  skip(guildId) {
    const state = this.getState(guildId);
    if (!state.current) return { ok: false };
    state.player.stop(true);
    return { ok: true };
  }

  stop(guildId) {
    const state = this.getState(guildId);
    state.queue = [];
    state.current = null;
    state.player.stop();
    if (state.connection) {
      state.connection.destroy();
      state.connection = null;
    }
    return { ok: true };
  }

  setVolume(guildId, volume) {
    const state = this.getState(guildId);
    state.volume = volume;

    const resource = state.player.state.resource;
    if (resource?.volume) resource.volume.setVolume(volume / 100);

    return { ok: true };
  }

  setLoopMode(guildId, mode) {
    const state = this.getState(guildId);
    state.loopMode = mode;
  }

  shuffle(guildId) {
    const state = this.getState(guildId);
    if (state.queue.length <= 2) return 0;

    const [current, ...rest] = state.queue;
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    state.queue = [current, ...rest];
    return rest.length;
  }
}

module.exports = { LocalMusicPlayer };
