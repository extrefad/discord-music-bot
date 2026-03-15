const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');

// Instâncias públicas Invidious que ainda respondem em março 2026 (baseado em listas atualizadas)
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://invidious.f5.si',
  'https://iv.melmac.space',
];

async function getAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${base}/api/v1/videos/${videoId}?fields=formatStreams`);
      if (!response.ok) continue;
      const data = await response.json();
      // Procura formato áudio (opus ou m4a preferencial)
      const audioFormat = data.formatStreams?.find(f => f.type === 'audio' || f.audioQuality);
      if (audioFormat?.url) {
        console.log(`[SUCCESS] Áudio de ${base}`);
        return audioFormat.url;
      }
    } catch (err) {
      console.warn(`Instância ${base} falhou: ${err.message}`);
    }
  }
  throw new Error('Nenhuma instância Invidious retornou stream de áudio');
}

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

    this.player.on(AudioPlayerStatus.Idle, () => this._onTrackEnd());

    this.player.on('error', (err) => {
      console.error('Player error:', err);
      this.textChannel.send(`❌ Erro ao tocar **${this.current?.title}**. Pulando...`);
      this._onTrackEnd();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        this.destroy();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => this.destroy());
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
      this.textChannel.send('Fila terminou! Use /tocar pra adicionar mais.');
      return;
    }

    this.current = this.tracks.shift();

    try {
      // Extrai videoId da URL (suporta youtube.com e youtu.be)
      const urlObj = new URL(this.current.url);
      let videoId = urlObj.searchParams.get('v');
      if (!videoId && urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      }
      if (!videoId) throw new Error('Não encontrou videoId na URL');

      const audioUrl = await getAudioUrl(videoId);

      const resource = createAudioResource(audioUrl, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      resource.volume?.setVolume(this.volume);
      this.player.play(resource);

      this.textChannel.send(`🎵 Tocando: **${this.current.title}** (${this.current.duration})\nAdicionado por ${this.current.requestedBy}`);
    } catch (err) {
      console.error('Falha no stream:', err.message);
      this.textChannel.send(`❌ Falhou ao tocar **${this.current.title}** (todas instâncias caíram?). Pulando...`);
      await this.playNext();
    }
  }

  _onTrackEnd() {
    if (this.loop && this.current) this.tracks.unshift(this.current);
    else if (this.loopQueue && this.current) this.tracks.push(this.current);
    this.playNext();
  }

  pause() { this.player.pause(); }
  resume() { this.player.unpause(); }
  skip() { this.player.stop(); }
  stop() {
    this.tracks = [];
    this.loop = false;
    this.loopQueue = false;
    this.player.stop();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(2, vol / 100)); // cap em 200% pra não distorcer
    if (this.player.state.resource?.volume) this.player.state.resource.volume.setVolume(this.volume);
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
  try {
    // Se for link direto, extrai videoId
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      const url = new URL(query);
      let videoId = url.searchParams.get('v');
      if (!videoId && url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
      if (videoId) {
        return {
          title: 'Vídeo do YouTube',
          url: `https://youtube.com/watch?v=${videoId}`,
          duration: '??:??',
          requestedBy,
        };
      }
    }

    // Busca via Invidious (primeira instância)
    const res = await fetch(`https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    const results = await res.json();
    if (!results?.length) return null;

    const vid = results[0];
    return {
      title: vid.title,
      url: `https://youtube.com/watch?v=${vid.videoId}`,
      duration: vid.duration || '??:??',
      requestedBy,
    };
  } catch (err) {
    console.error('Busca falhou:', err);
    return null;
  }
}

module.exports = { MusicQueue, searchTrack };