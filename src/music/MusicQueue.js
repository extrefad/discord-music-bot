const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const https      = require('https');
const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const YT_API_KEY = process.env.YT_API_KEY;

// ─── Busca via YouTube Data API v3 ───────────────────────────────────────────
async function searchYouTubeAPI(query) {
  if (!YT_API_KEY) throw new Error('YT_API_KEY não configurada');
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
  const data = await fetchJson(url);
  const item = data?.items?.[0];
  if (!item) throw new Error('Nenhum resultado encontrado');
  const videoId = item.id.videoId;
  const title   = item.snippet.title;
  return { videoId, title };
}

// ─── Busca duração via YouTube Data API v3 ────────────────────────────────────
async function getVideoDuration(videoId) {
  try {
    const url  = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${YT_API_KEY}`;
    const data = await fetchJson(url);
    const iso  = data?.items?.[0]?.contentDetails?.duration || 'PT0S';
    return parseDuration(iso);
  } catch { return '0:00'; }
}

// ─── Converte duração ISO 8601 para string ────────────────────────────────────
function parseDuration(iso) {
  const h = (iso.match(/(\d+)H/) || [])[1] || 0;
  const m = (iso.match(/(\d+)M/) || [])[1] || 0;
  const s = (iso.match(/(\d+)S/) || [])[1] || 0;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ─── Pega stream via yt-dlp ───────────────────────────────────────────────────
function getAudioStream(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlp = spawn('yt-dlp', [
    '-x',
    '--audio-format', 'opus',
    '--no-playlist',
    '-o', '-',
    '--quiet',
    url,
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  return ytdlp.stdout;
}

// ─── Helper HTTP ──────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON inválido')); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── Extrai ID do YouTube ─────────────────────────────────────────────────────
function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

// ─── Formata duração em segundos ──────────────────────────────────────────────
function formatDuration(s) {
  s = parseInt(s) || 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// ─── Busca universal ──────────────────────────────────────────────────────────
async function searchTrack(query, requestedBy) {
  try {
    let videoId, title, duration;

    // YouTube URL
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      videoId = extractYoutubeId(query);
      if (videoId) {
        const url  = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`;
        const data = await fetchJson(url);
        const item = data?.items?.[0];
        title    = item?.snippet?.title || 'Sem título';
        duration = parseDuration(item?.contentDetails?.duration || 'PT0S');
      }
    }

    // Spotify ou nome → busca no YouTube
    if (!videoId) {
      let searchQuery = query;
      if (query.includes('spotify.com')) {
        // Pega o texto da URL como fallback
        searchQuery = decodeURIComponent(query.split('/track/')[1]?.split('?')[0] || query);
      }
      const result = await searchYouTubeAPI(searchQuery);
      videoId  = result.videoId;
      title    = result.title;
      duration = await getVideoDuration(videoId);
    }

    console.log(`✅ Encontrado: ${title} [${videoId}]`);
    return {
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      duration,
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
      console.log(`🎵 Iniciando stream: ${this.current.title}`);

      const audioStream = getAudioStream(this.current.videoId);

      const resource = createAudioResource(audioStream, {
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