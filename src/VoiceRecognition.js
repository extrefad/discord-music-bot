const { EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const path  = require('path');
const { PassThrough } = require('stream');

let vosk, VoskModel;

try {
  vosk = require('vosk');
  vosk.setLogLevel(-1);
  const MODEL_PATH = path.join(__dirname, '../../vosk-model');
  VoskModel = new vosk.Model(MODEL_PATH);
  console.log('🎤 Vosk carregado — reconhecimento de voz ativo!');
} catch (err) {
  console.warn('⚠️  Vosk não encontrado ou modelo ausente.');
  VoskModel = null;
}

const TRIGGER_WORD = 'música';

const VOICE_COMMANDS = {
  play:       ['tocar', 'play', 'reproduzir', 'colocar', 'botar'],
  pause:      ['pausar', 'pause'],
  resume:     ['continuar', 'despausar'],
  skip:       ['pular', 'skip', 'próxima', 'próximo', 'avançar'],
  stop:       ['parar tudo', 'encerrar', 'sair', 'stop'],
  shuffle:    ['embaralhar', 'aleatório', 'shuffle'],
  loop:       ['repetir', 'loop'],
  volumeUp:   ['volume alto', 'aumentar volume', 'mais alto'],
  volumeDown: ['volume baixo', 'diminuir volume', 'mais baixo'],
};

function startVoiceRecognition(connection, client, guildId, textChannel) {
  if (!VoskModel) {
    textChannel.send('⚠️ Reconhecimento de voz indisponível. Verifique o modelo Vosk.');
    return;
  }

  const receiver = connection.receiver;

  receiver.speaking.on('start', (userId) => {
    const recognizer = new vosk.Recognizer({ model: VoskModel, sampleRate: 16000 });
    const audioStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 800 },
    });

    const pcmDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const pass = new PassThrough();
    const chunks = [];

    audioStream.pipe(pcmDecoder).pipe(pass);

    pass.on('data', (chunk) => {
      const mono16k = downsample(chunk, 48000, 2, 16000);
      chunks.push(mono16k);
      recognizer.acceptWaveform(mono16k);
    });

    pass.on('end', async () => {
      if (chunks.length < 3) { recognizer.free(); return; }
      const result = recognizer.finalResult();
      recognizer.free();
      const text = result?.text?.trim().toLowerCase();
      if (!text || text.length < 3) return;
      console.log(`🗣️ [${userId}] "${text}"`);
      await processVoiceCommand(text, userId, guildId, client, textChannel);
    });

    pass.on('error', () => recognizer.free());
  });
}

function downsample(buffer, fromRate, fromChannels, toRate) {
  const samples = buffer.length / 2 / fromChannels;
  const ratio   = fromRate / toRate;
  const outLen  = Math.floor(samples / ratio);
  const out     = Buffer.alloc(outLen * 2);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.floor(i * ratio);
    const sample = buffer.readInt16LE(srcIdx * fromChannels * 2);
    out.writeInt16LE(sample, i * 2);
  }
  return out;
}

async function processVoiceCommand(text, userId, guildId, client, textChannel) {
  if (!text.includes(TRIGGER_WORD)) return;
  const queue = client.musicQueues.get(guildId);

  for (const [action, keywords] of Object.entries(VOICE_COMMANDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        await executeVoiceAction(action, text, kw, userId, guildId, client, queue, textChannel);
        return;
      }
    }
  }

  const afterTrigger = text.split(TRIGGER_WORD)[1]?.trim();
  if (afterTrigger && afterTrigger.length > 2) {
    await executeVoiceAction('play', text, '', userId, guildId, client, queue, textChannel, afterTrigger);
  }
}

async function executeVoiceAction(action, fullText, keyword, userId, guildId, client, queue, textChannel, overrideQuery) {
  const guild    = client.guilds.cache.get(guildId);
  const member   = guild?.members.cache.get(userId);
  const username = member?.displayName || `<@${userId}>`;

  switch (action) {
    case 'play': {
      let query = overrideQuery;
      if (!query) {
        for (const kw of VOICE_COMMANDS.play) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) { query = fullText.slice(idx + kw.length).trim(); break; }
        }
      }
      query = query?.replace(TRIGGER_WORD, '').trim();
      if (!query || query.length < 2) {
        textChannel.send(`🎤 ${username} disse "tocar" mas não entendi o nome da música.`);
        return;
      }
      textChannel.send(`🎤 **${username}** pediu por voz: **${query}**\n🔍 Buscando...`);

      const { searchTrack, MusicQueue } = require('../music/MusicQueue');
      const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

      const track = await searchTrack(query, username);
      if (!track) { textChannel.send(`❌ Nenhum resultado para: **${query}**`); return; }

      let musicQueue = client.musicQueues.get(guildId);
      if (!musicQueue) {
        const voiceChannel = member?.voice.channel;
        if (!voiceChannel) { textChannel.send(`🎤 ${username}, entre em um canal de voz primeiro!`); return; }
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false, selfMute: false,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        musicQueue = new MusicQueue(guildId, connection, textChannel);
        client.musicQueues.set(guildId, musicQueue);
        startVoiceRecognition(connection, client, guildId, textChannel);
      }

      await musicQueue.addTrack(track);
      if (musicQueue.current?.url !== track.url) {
        textChannel.send(`✅ **${track.title}** adicionada à fila por ${username}`);
      }
      break;
    }
    case 'pause':
      if (!queue) return;
      if (queue.isPaused()) { queue.resume(); textChannel.send(`▶️ Continuando — ${username} (voz)`); }
      else { queue.pause(); textChannel.send(`⏸️ Pausado — ${username} (voz)`); }
      break;
    case 'resume':
      if (!queue) return;
      queue.resume(); textChannel.send(`▶️ Continuando — ${username} (voz)`);
      break;
    case 'skip':
      if (!queue) return;
      queue.skip(); textChannel.send(`⏭️ Pulado por ${username} (voz)`);
      break;
    case 'stop':
      if (!queue) return;
      queue.stop(); queue.destroy();
      client.musicQueues.delete(guildId);
      textChannel.send(`⏹️ Música parada por ${username} (voz)`);
      break;
    case 'shuffle':
      if (!queue) return;
      queue.shuffle(); textChannel.send(`🔀 Fila embaralhada por ${username} (voz)`);
      break;
    case 'loop':
      if (!queue) return;
      textChannel.send(`🔁 Loop ${queue.toggleLoop() ? 'ativado' : 'desativado'} por ${username} (voz)`);
      break;
    case 'volumeUp':
      if (!queue) return;
      queue.setVolume(Math.min(100, Math.round(queue.volume * 100) + 20));
      textChannel.send(`🔊 Volume aumentado — ${username} (voz)`);
      break;
    case 'volumeDown':
      if (!queue) return;
      queue.setVolume(Math.max(0, Math.round(queue.volume * 100) - 20));
      textChannel.send(`🔉 Volume diminuído — ${username} (voz)`);
      break;
  }
}

module.exports = { startVoiceRecognition };
