const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const https = require('https');
const http  = require('http');

// Instâncias públicas do Invidious — se uma falhar, tenta a próxima
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://iv.melmac.space',
  'https://invidious.io.lol',
];

// ─── Busca info do vídeo via Invidious ────────────────────────────────────────
async function getVideoInfo(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/api/v1/videos/${videoId}?fields=title,lengthSeconds,adaptiveFormats,formatStreams`);
      if (data && data.title) return { data, instance };
    } catch {}
  }
  throw new Error('Todas as instâncias Invidious falharam');
}

// ─── Pega URL do stream de áudio ──────────────────────────────────────────────
async function getAudioUrl(videoId) {
  const { data } = await getVideoInfo(videoId);

  // Tenta pegar opus/webm (melhor qualidade)
  const formats = data.adaptiveFormats || [];
  const audioFormats = formats
    .filter(f => f.type?.includes('audio'))
    .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

  if (audioFormats.length > 0) {
    return audioFormats[0].url;
  }

  // Fallback: formatStreams (menor qualidade mas mais compatível)
  const fallback = data.formatStreams?.[0];
  if (fallback) return fallback.url;

  throw new Error('Nenhum formato de áudio encontrado');
}

// ─── Busca vídeos no YouTube via Invidious ────────────────────────────────────
async function searchInvidious(query) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const results = await fetchJson(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,lengthSeconds`
      );
      if (results?.length > 0) return { result: results[0], instance };
    } catch {}
  }
  throw new Error('Busca falhou em todas as instâncias');
}

// ─── Helper fetch JSON ────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON inválido')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── Extrai ID do YouTube de uma URL ─────────────────────────────────────────
function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.replace('/', '');
  } catch {
    return null;
  }
}

// ─── Formata duração ──────────────────────────────────────────────────────────
function formatDuration(s) {
  s = parseInt(s) || 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// ─── Busca universal ──────────────────────────────────────────────────────────
async function searchTrack(query, requestedBy) {
  try {
    // Spotify → extrai nome do artista + música do título da página
    if (query.includes('spotify.com/track')) {
      console.log('🟢 Spotify detectado, buscando no YouTube...');
      // Remove o link e busca pelo texto da URL
      const spotifyId = query.split('/track/')[1]?.split('?')[0];
      // Tenta buscar via nome da URL (fallback simples)
      const searchQuery = query; // vai buscar pelo link como texto
      const { result } = await searchInvidious(spotifyId || query);
      return {
        title:       result.title,
        url:         `https://www.youtube.com/watch?v=${result.videoId}`,
        videoId:     result.videoId,
        duration:    formatDuration(result.lengthSeconds),
        requestedBy,
      };
    }

    // YouTube URL → extrai ID
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      const videoId = extractYoutubeId(query);
      if (videoId) {
        const { data } = await getVideoInfo(videoId);
        return {
          title:    data.title,
          url:      `https://www.youtube.com/watch?v=${videoId}`,
          videoId,
          duration: formatDuration(data.lengthSeconds),
          requestedBy,
        };
      }
    }

    // Nome → busca no Invidious
    console.log(`🔍 Buscando: "${query}"`);
    const { result } = await searchInvidious(query);
    return {
      title:    result.title,
      url:      `https://www.youtube.com/watch?v=${result.videoId}`,
      videoId:  result.videoId,
      duration: formatDuration(result.lengthSeconds),
      requestedBy,
    };
  } catch (err) {
    console.error('Erro em searchTrack:', err.message);
    return null;
  }
}

// ─── MusicQueue ───────────────────────────────────────────────────────────────
class MusicQueue {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId     = guildId;
    this.connection  = voiceConnection;
    this.textChannel = textChannel;
    this.player      = createAudioPlayer();
    this.tracks      = [];
    this.current     = null;
    this.volume      = 0.5;
    this.loop        = false;
    this.loopQueue   = false;

    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => this._onTrackEnd());
    this.player.on('error', (err) => {
      console.error('Player erro:', err.message);
      this.textChannel.send(`❌ Erro ao reproduzir **${this.current?.title}**. Pulando...`);
      this._onTrackEnd();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch { this.destroy(); }
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
      this.textChannel.send('✅ Fila finalizada! Use `/tocar` para adicionar mais músicas.');
      return;
    }

    this.current = this.tracks.shift();

    try {
      console.log(`🎵 Obtendo stream para: ${this.current.title}`);
      const audioUrl = await getAudioUrl(this.current.videoId);
      console.log(`✅ Stream obtido!`);

      const resource = createAudioResource(audioUrl, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      resource.volume?.setVolume(this.volume);
      this.player.play(resource);

      this.textChannel.send(
        `🎵 **Tocando agora:**\n` +
        `> **${this.current.title}**\n` +
        `> 👤 ${this.current.requestedBy} | ⏱️ ${this.current.duration}`
      );
    } catch (err) {
      console.error('Erro ao iniciar stream:', err.message);
      this.textChannel.send(`❌ Não foi possível reproduzir **${this.current.title}**. Pulando...`);
      await this.playNext();
    }
  }

  _onTrackEnd() {
    if (this.loop && this.current)           this.tracks.unshift(this.current);
    else if (this.loopQueue && this.current) this.tracks.push(this.current);
    this.playNext();
  }

  pause()  { return this.player.pause(); }
  resume() { return this.player.unpause(); }
  skip()   { this.player.stop(); }
  stop()   { this.tracks = []; this.loop = false; this.loopQueue = false; this.player.stop(); }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol / 100));
    this.player.state.resource?.volume?.setVolume(this.volume);
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  toggleLoop()      { this.loop      = !this.loop;      if (this.loop)      this.loopQueue = false; return this.loop; }
  toggleLoopQueue() { this.loopQueue = !this.loopQueue; if (this.loopQueue) this.loop      = false; return this.loopQueue; }

  destroy() {
    this.tracks = []; this.current = null;
    try { this.player.stop(true); } catch {}
    try { this.connection.destroy(); } catch {}
  }

  isPlaying() { return this.player.state.status === AudioPlayerStatus.Playing; }
  isPaused()  { return this.player.state.status === AudioPlayerStatus.Paused; }
}

module.exports = { MusicQueue, searchTrack };