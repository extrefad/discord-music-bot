const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { MusicQueue, searchTrack } = require('../music/MusicQueue');
const { startVoiceRecognition } = require('../voice/VoiceRecognition');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música — YouTube, Spotify ou nome')
    .addStringOption(opt =>
      opt.setName('musica')
        .setDescription('Nome, link do YouTube ou link do Spotify')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const query        = interaction.options.getString('musica').trim();
    const member       = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply('❌ Entre em um **canal de voz** primeiro!');
    }

    // Detecta fonte para emoji
    const isSpotify = query.includes('spotify.com');
    const isYoutube = query.includes('youtube.com') || query.includes('youtu.be');
    const emoji     = isSpotify ? '🟢' : isYoutube ? '🔴' : '🔍';
    const label     = isSpotify ? 'Spotify' : isYoutube ? 'YouTube' : 'Buscando';

    await interaction.editReply(`${emoji} ${label}: **${query}**...`);

    const track = await searchTrack(query, member.displayName).catch(() => null);

    if (!track) {
      return interaction.editReply(
        `❌ Não encontrei nada para: **${query}**\n> Tente o nome da música, ex: \`/tocar Shape of You\``
      );
    }

    const guildId = interaction.guildId;
    let queue     = client.musicQueues.get(guildId);

    // ─── Detecta se o bot foi desconectado/kickado ──────────────────────────
    if (queue) {
      const status = queue.connection?.state?.status;
      const foiDesconectado =
        status === VoiceConnectionStatus.Destroyed ||
        status === VoiceConnectionStatus.Disconnected ||
        !queue.connection;

      if (foiDesconectado) {
        // Avisa no chat e limpa a fila antiga
        interaction.channel.send(
          '🔌 **Voxara foi desconectado do canal de voz.**\n' +
          '> Entrando novamente para continuar...'
        );
        queue.destroy();
        client.musicQueues.delete(guildId);
        queue = null;
      }
    }

    // ─── Conecta ao canal de voz ────────────────────────────────────────────
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId:      voiceChannel.id,
        guildId:        voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf:       false,
        selfMute:       false,
      });

      connection.on('error', err => console.error('Erro de voz:', err.message));

      // Quando destruída — avisa no chat e limpa o map
      connection.on(VoiceConnectionStatus.Destroyed, () => {
        const q = client.musicQueues.get(guildId);
        if (q) {
          q.textChannel.send(
            '🔌 **Voxara foi desconectado do canal de voz.**\n' +
            '> Use `/tocar` para chamar novamente!'
          );
          q.destroy();
        }
        client.musicQueues.delete(guildId);
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

    // ─── Adiciona à fila ────────────────────────────────────────────────────
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