const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const playdl = require('play-dl');

class MusicQueue {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId = guildId;
    this.connection = voiceConnection;
    this.textChannel = textChannel;
    this.player = createAudioPlayer();
    this.tracks = [];
    this.current = null;
    this.volume = 0.5;
    this.loop = false;
    this.loopQueue = false;

    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => {
      this._onTrackEnd();
    });

    this.player.on('error', (error) => {
      console.error('Erro no player:', error.message);
      this.textChannel.send(`❌ Erro ao reproduzir: ${this.current?.title || 'música desconhecida'}`);
      this._onTrackEnd();
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.destroy();
    });
  }

  async addTrack(track) {
    this.tracks.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNext();
    }
  }

  async playNext() {
    if (this.tracks.length === 0) {
      this.current = null;
      this.textChannel.send('✅ Fila finalizada! Use `/tocar` para adicionar mais músicas.');
      return;
    }

    this.current = this.tracks.shift();

    try {
      const stream = await playdl.stream(this.current.url, {
        quality: 2,
        discordPlayerCompatibility: true,
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      resource.volume?.setVolume(this.volume);
      this.player.play(resource);
      this.textChannel.send(`🎵 **Tocando agora:** ${this.current.title}\n> 👤 ${this.current.requestedBy} | ⏱️ ${this.current.duration}`);
    } catch (error) {
      console.error('Erro ao iniciar stream:', error);
      this.textChannel.send(`❌ Não foi possível reproduzir **${this.current.title}**. Pulando...`);
      await this.playNext();
    }
  }

  _onTrackEnd() {
    if (this.loop && this.current) {
      this.tracks.unshift(this.current);
    } else if (this.loopQueue && this.current) {
      this.tracks.push(this.current);
    }
    this.playNext();
  }

  pause()  { return this.player.pause(); }
  resume() { return this.player.unpause(); }
  skip()   { this.player.stop(); }

  stop() {
    this.tracks = [];
    this.loop = false;
    this.loopQueue = false;
    this.player.stop();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol / 100));
    if (this.player.state.resource) {
      this.player.state.resource.volume?.setVolume(this.volume);
    }
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  toggleLoop() {
    this.loop = !this.loop;
    if (this.loop) this.loopQueue = false;
    return this.loop;
  }

  toggleLoopQueue() {
    this.loopQueue = !this.loopQueue;
    if (this.loopQueue) this.loop = false;
    return this.loopQueue;
  }

  destroy() {
    this.tracks = [];
    this.current = null;
    try { this.player.stop(true); } catch {}
    try { this.connection.destroy(); } catch {}
  }

  isPlaying() { return this.player.state.status === AudioPlayerStatus.Playing; }
  isPaused()  { return this.player.state.status === AudioPlayerStatus.Paused; }
}

async function searchTrack(query, requestedBy) {
  let info;
  if (playdl.yt_validate(query) === 'video') {
    const results = await playdl.video_info(query);
    info = results.video_details;
  } else {
    const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!results.length) return null;
    info = results[0];
  }
  return {
    title: info.title || 'Título desconhecido',
    url: info.url,
    duration: formatDuration(info.durationInSec || 0),
    requestedBy,
  };
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

module.exports = { MusicQueue, searchTrack };
