const {
  createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, StreamType,
} = require('@discordjs/voice');
const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const YT_API_KEY  = process.env.YT_API_KEY;
const COOKIE_PATH = path.join('/tmp', 'yt-cookies.txt');

// ─── Busca via YouTube Data API ───────────────────────────────────────────────
async function searchYouTubeAPI(query) {
  if (!YT_API_KEY) throw new Error('YT_API_KEY nao configurada no Railway');
  const data = await fetchJson(
    'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=' +
    encodeURIComponent(query) + '&key=' + YT_API_KEY
  );
  const item = data?.items?.[0];
  if (!item) throw new Error('Sem resultados para: ' + query);
  return { videoId: item.id.videoId, title: item.snippet.title };
}

async function getVideoDuration(videoId) {
  try {
    const data = await fetchJson(
      'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=' +
      videoId + '&key=' + YT_API_KEY
    );
    return parseDuration(data?.items?.[0]?.contentDetails?.duration || 'PT0S');
  } catch { return '0:00'; }
}

function parseDuration(iso) {
  const h = parseInt((iso.match(/(\d+)H/) || [])[1] || 0);
  const m = parseInt((iso.match(/(\d+)M/) || [])[1] || 0);
  const s = parseInt((iso.match(/(\d+)S/) || [])[1] || 0);
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  return m + ':' + String(s).padStart(2,'0');
}

// ─── Stream via yt-dlp com cliente Android (bypassa bot detection) ─────────
function getAudioStream(videoId) {
  // Regrava cookie em disco a cada chamada
  if (process.env.YT_COOKIE) {
    try { fs.writeFileSync(COOKIE_PATH, process.env.YT_COOKIE); } catch {}
  }

  const args = [
    '--no-playlist',
    '--format', 'bestaudio/best',
    '--get-url',
    '--no-warnings',
    '--extractor-retries', '3',
    '--extractor-args', 'youtube:player_client=android',
  ];

  if (fs.existsSync(COOKIE_PATH)) args.push('--cookies', COOKIE_PATH);
  args.push('https://www.youtube.com/watch?v=' + videoId);

  const ytdlp = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  return new Promise((resolve, reject) => {
    let audioUrl = '', errorOut = '', settled = false;

    const done = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve(val);
    };

    const timer = setTimeout(() => {
      ytdlp.kill('SIGKILL');
      done(new Error('yt-dlp timeout 30s'));
    }, 30000);

    ytdlp.stdout.on('data', d => audioUrl += d.toString());
    ytdlp.stderr.on('data', d => errorOut += d.toString());
    ytdlp.on('error', err => done(new Error('yt-dlp spawn erro: ' + err.message)));
    ytdlp.on('close', (code) => {
      audioUrl = audioUrl.split('\n')[0].trim();
      if (errorOut) console.warn('yt-dlp stderr:', errorOut.slice(0, 300));
      if (!audioUrl || code !== 0) {
        done(new Error('yt-dlp falhou code=' + code + ': ' + errorOut.slice(0, 150)));
        return;
      }
      console.log('Stream URL obtida via yt-dlp!');
      const ffmpeg = spawn(ffmpegPath, [
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', audioUrl, '-analyzeduration', '0', '-loglevel', '0',
        '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      ffmpeg.on('error', e => console.error('ffmpeg erro:', e.message));
      done(null, ffmpeg.stdout);
    });
  });
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON invalido')); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

// ─── Extrai ID do YouTube ─────────────────────────────────────────────────────
function extractYoutubeId(query) {
  try {
    const u = new URL(query);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

// ─── Busca universal ──────────────────────────────────────────────────────────
async function searchTrack(query, requestedBy) {
  try {
    let videoId, title, duration;

    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      videoId = extractYoutubeId(query);
      if (videoId) {
        const data = await fetchJson(
          'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=' +
          videoId + '&key=' + YT_API_KEY
        );
        const item = data?.items?.[0];
        title    = item?.snippet?.title || 'Sem titulo';
        duration = parseDuration(item?.contentDetails?.duration || 'PT0S');
      }
    }

    if (!videoId) {
      let q = query;
      if (query.includes('spotify.com/track'))
        q = decodeURIComponent(query.split('/track/')[1]?.split('?')[0] || query);
      const r = await searchYouTubeAPI(q);
      videoId = r.videoId; title = r.title;
      duration = await getVideoDuration(videoId);
    }

    console.log('Encontrado: ' + title + ' [' + videoId + ']');
    return { title, url: 'https://www.youtube.com/watch?v=' + videoId, videoId, duration, requestedBy };
  } catch (err) {
    console.error('Erro searchTrack:', err.message);
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
      this.textChannel.send('Erro ao reproduzir **' + (this.current?.title || '?') + '**. Pulando...');
      this._onTrackEnd();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.textChannel.send('🔌 Voxara foi desconectado. Use `/tocar` para chamar novamente!');
        this.destroy();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => this.destroy());
  }

  async addTrack(track) {
    this.tracks.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) await this.playNext();
  }

  async playNext() {
    if (this.tracks.length === 0) {
      this.current = null;
      this.textChannel.send('✅ Fila finalizada! Use `/tocar` para adicionar mais musicas.');
      return;
    }

    this.current = this.tracks.shift();

    try {
      console.log('Iniciando stream: ' + this.current.title);
      const audioStream = await getAudioStream(this.current.videoId);
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume);
      this.player.play(resource);
      this.textChannel.send(
        '🎵 **Tocando agora:**\n> **' + this.current.title + '**\n> 👤 ' +
        this.current.requestedBy + ' | ⏱️ ' + this.current.duration
      );
    } catch (err) {
      console.error('Erro stream:', err.message);
      this.textChannel.send('❌ Nao foi possivel reproduzir **' + this.current.title + '**. Pulando...');
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

  toggleLoop()      { this.loop = !this.loop; if (this.loop) this.loopQueue = false; return this.loop; }
  toggleLoopQueue() { this.loopQueue = !this.loopQueue; if (this.loopQueue) this.loop = false; return this.loopQueue; }

  destroy() {
    this.tracks = []; this.current = null;
    try { this.player.stop(true); } catch {}
    try { this.connection.destroy(); } catch {}
  }

  isPlaying() { return this.player.state.status === AudioPlayerStatus.Playing; }
  isPaused()  { return this.player.state.status === AudioPlayerStatus.Paused; }
}

module.exports = { MusicQueue, searchTrack };