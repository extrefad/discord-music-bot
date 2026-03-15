const { SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { MusicQueue, searchTrack } = require('../music/MusicQueue');
const { startVoiceRecognition } = require('../voice/VoiceRecognition');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música ou adiciona à fila')
    .addStringOption(opt =>
      opt.setName('musica')
        .setDescription('Nome da música ou URL do YouTube')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    let query          = interaction.options.getString('musica');
    const member       = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply('❌ Você precisa estar em um **canal de voz** primeiro!');
    }

    // Limpa URL do YouTube (remove playlist e parâmetros extras)
    try {
      const url = new URL(query);
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        const videoId = url.searchParams.get('v') || url.pathname.replace('/', '');
        if (videoId) query = `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch { /* não é URL */ }

    await interaction.editReply(`🔍 Buscando: **${query}**...`);

    const track = await searchTrack(query, member.displayName).catch(() => null);
    if (!track) {
      return interaction.editReply(`❌ Não encontrei nada para: **${query}**`);
    }

    const guildId = interaction.guildId;
    let queue = client.musicQueues.get(guildId);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId:      voiceChannel.id,
        guildId:        voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf:       false,
        selfMute:       false,
      });

      // Reconecta se cair
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          connection.destroy();
          client.musicQueues.delete(guildId);
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        client.musicQueues.delete(guildId);
      });

      connection.on('error', err => {
        console.error('Erro na conexão de voz:', err.message);
      });

      queue = new MusicQueue(guildId, connection, interaction.channel);
      client.musicQueues.set(guildId, queue);

      startVoiceRecognition(connection, client, guildId, interaction.channel);

      interaction.channel.send(
        '🎙️ **Voxara entrou no canal!**\n' +
        '> Fale **"música"** + comando para controlar por voz:\n' +
        '> *"música pausar"* • *"música pular"* • *"música tocar [nome]"*'
      );
    }

    await queue.addTrack(track);

    if (queue.current?.url !== track.url) {
      await interaction.editReply(
        `✅ **${track.title}** adicionada à fila!\n` +
        `> ⏱️ ${track.duration} | 📋 Posição: ${queue.tracks.length}`
      );
    } else {
      await interaction.editReply(`🎵 Tocando agora: **${track.title}**`);
    }
  },
};