const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
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

    let query       = interaction.options.getString('musica');
    const member    = interaction.member;
    const voiceChannel = member.voice?.channel;

    // ─── Verifica se está em canal de voz ─────────────────────────────────────
    if (!voiceChannel) {
      return interaction.editReply('❌ Você precisa estar em um **canal de voz** primeiro!');
    }

    // ─── Limpa URL do YouTube (remove playlist e parâmetros extras) ────────────
    try {
      const url = new URL(query);
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        const videoId = url.searchParams.get('v') || url.pathname.replace('/', '');
        if (videoId) {
          query = `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
    } catch {
      // não é URL, é nome de música — tudo bem
    }

    await interaction.editReply(`🔍 Buscando: **${query}**...`);

    // ─── Busca a música ────────────────────────────────────────────────────────
    const track = await searchTrack(query, member.displayName).catch(err => {
      console.error('Erro na busca:', err);
      return null;
    });

    if (!track) {
      return interaction.editReply(`❌ Não encontrei nada para: **${query}**\n> Tente usar o nome da música em vez do link.`);
    }

    // ─── Conecta ao canal de voz ───────────────────────────────────────────────
    const guildId = interaction.guildId;
    let queue = client.musicQueues.get(guildId);

    if (!queue) {
      let connection;
      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

      } catch (err) {
        console.error('Erro ao conectar na voz:', err);
        if (connection) connection.destroy();
        return interaction.editReply(
          '❌ Não consegui entrar no canal de voz.\n' +
          '> • Verifique se o Voxara tem permissão de **Conectar** e **Falar** no canal\n' +
          '> • Tente sair e entrar no canal de voz novamente'
        );
      }

      queue = new MusicQueue(guildId, connection, interaction.channel);
      client.musicQueues.set(guildId, queue);

      startVoiceRecognition(connection, client, guildId, interaction.channel);

      interaction.channel.send(
        '🎙️ **Voxara entrou no canal!**\n' +
        '> Fale **"música"** + comando para controlar por voz:\n' +
        '> *"música pausar"* • *"música pular"* • *"música tocar [nome]"*'
      );
    }

    // ─── Adiciona à fila ───────────────────────────────────────────────────────
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