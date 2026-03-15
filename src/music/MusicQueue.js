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
    console.log(`✅ URL obtida: ${audioUrl.substring(0, 60)}...`);

    const { spawn } = require('child_process');
    const ffmpegPath = require('ffmpeg-static');

    const ffmpeg = spawn(ffmpegPath, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', audioUrl,
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
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