const {
  createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, StreamType,
} = require('@discordjs/voice');
const https      = require('https');
const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const YT_API_KEY = process.env.YT_API_KEY;

async function searchYouTubeAPI(query) {
  if (!YT_API_KEY) throw new Error('YT_API_KEY nao configurada');
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`);
  const item = data?.items?.[0];
  if (!item) throw new Error('Nenhum resultado encontrado');
  return { videoId: item.id.videoId, title: item.snippet.title };
}

async function getVideoDuration(videoId) {
  try {
    const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${YT_API_KEY}`);
    return parseDuration(data?.items?.[0]?.contentDetails?.duration || 'PT0S');
  } catch { return '0:00'; }
}

function parseDuration(iso) {
  const h = (iso.match(/(\d+)H/) || [])[1] || 0;
  const m = (iso.match(/(\d+)M/) || [])[1] || 0;
  const s = (iso.match(/(\d+)S/) || [])[1] || 0;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function getAudioStream(videoId) {
  const ytdlp = spawn('yt-dlp', [
    '--no-playlist', '--format', 'bestaudio', '--get-url', '--quiet',
    `https://www.youtube.com/watch?v=${videoId}`,
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  return new Promise((resolve, reject) => {
    let audioUrl = '';
    ytdlp.stdout.on('data', d => audioUrl += d.toString().trim());
    ytdlp.on('close', (code) => {
      if (!audioUrl || code !== 0) { reject(new Error('yt-dlp nao retornou URL')); return; }
      console.log('Stream URL obtida via yt-dlp');
      const ffmpeg = spawn(ffmpegPath, [
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', audioUrl, '-analyzeduration', '0', '-loglevel', '0',
        '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      resolve(ffmpeg.stdout);
    });
    ytdlp.on('error', reject);
  });
}

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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

async function searchTrack(query, requestedBy) {
  try {
    let videoId, title, duration;

    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      videoId = extractYoutubeId(query);
      if (videoId) {
        const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`);
        const item = data?.items?.[0];
        title    = item?.snippet?.title || 'Sem titulo';
        duration = parseDuration(item?.contentDetails?.duration || 'PT0S');
      }
    }

    if (!videoId) {
      let q = query;
      if (query.includes('spotify.com'))
        q = decodeURIComponent(query.split('/track/')[1]?.split('?')[0] || query);
      const r = await searchYouTubeAPI(q);
      videoId  = r.videoId;
      title    = r.title;
      duration = await getVideoDuration(videoId);
    }

    console.log('Encontrado: ' + title + ' [' + videoId + ']');
    return { title, url: 'https://www.youtube.com/watch?v=' + videoId, videoId, duration, requestedBy };
  } catch (err) {
    console.error('Erro em searchTrack:', err.message);
    return null;
  }
}

class MusicQueue {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId = guildId; this.connection = voiceConnection; this.textChannel = textChannel;
    this.player = createAudioPlayer(); this.tracks = []; this.current = null;
    this.volume = 0.5; this.loop = false; this.loopQueue = false;

    this.connection.subscribe(this.player);
    this.player.on(AudioPlayerStatus.Idle, () => this._onTrackEnd());
    this.player.on('error', (err) => {
      console.error('Player erro:', err.message);
      this.textChannel.send('Erro ao reproduzir **' + this.current?.title + '**. Pulando...');
      this._onTrackEnd();
    });
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch { this.destroy(); }
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
      this.textChannel.send('Fila finalizada! Use `/tocar` para adicionar mais musicas.');
      return;
    }
    this.current = this.tracks.shift();
    try {
      console.log('Iniciando stream: ' + this.current.title);
      const audioStream = await getAudioStream(this.current.videoId);
      const resource = createAudioResource(audioStream, { inputType: StreamType.Raw, inlineVolume: true });
      resource.volume?.setVolume(this.volume);
      this.player.play(resource);
      this.textChannel.send('Tocando agora:\n> **' + this.current.title + '**\n> ' + this.current.requestedBy + ' | ' + this.current.duration);
    } catch (err) {
      console.error('Erro ao iniciar stream:', err.message);
      this.textChannel.send('Nao foi possivel reproduzir **' + this.current.title + '**. Pulando...');
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