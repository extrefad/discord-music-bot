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

    const query       = interaction.options.getString('musica');
    const member      = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.editReply('❌ Você precisa estar em um canal de voz!');
    }

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply('❌ Não tenho permissão para entrar/falar nesse canal.');
    }

    await interaction.editReply(`🔍 Buscando: **${query}**...`);

    const track = await searchTrack(query, member.displayName);
    if (!track) {
      return interaction.editReply(`❌ Nenhum resultado encontrado para: **${query}**`);
    }

    const guildId = interaction.guildId;
    let queue = client.musicQueues.get(guildId);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      } catch {
        connection.destroy();
        return interaction.editReply('❌ Não consegui conectar ao canal de voz.');
      }

      queue = new MusicQueue(guildId, connection, interaction.channel);
      client.musicQueues.set(guildId, queue);

      startVoiceRecognition(connection, client, guildId, interaction.channel);

      interaction.channel.send(
        '🎤 **Reconhecimento de voz ativo!**\n' +
        'Fale **"música"** seguido do comando:\n' +
        '> • *"música tocar [nome]"*\n' +
        '> • *"música pausar"* / *"música continuar"*\n' +
        '> • *"música pular"* / *"música parar tudo"*\n' +
        '> • *"música embaralhar"* / *"música repetir"*'
      );
    }

    await queue.addTrack(track);

    if (queue.current?.url !== track.url) {
      await interaction.editReply(
        `✅ Adicionado à fila:\n> **${track.title}**\n> ⏱️ ${track.duration} | 📋 Posição: ${queue.tracks.length}`
      );
    } else {
      await interaction.editReply(`🎵 Tocando: **${track.title}**`);
    }
  },
};
