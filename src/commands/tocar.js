const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { MusicQueue, searchTrack } = require('../music/MusicQueue');
const { startVoiceRecognition } = require('../voice/VoiceRecognition');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma musica — YouTube, Spotify ou nome')
    .addStringOption(opt =>
      opt.setName('musica').setDescription('Nome, link do YouTube ou Spotify').setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const query        = interaction.options.getString('musica').trim();
    const member       = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) return interaction.editReply('Entre em um **canal de voz** primeiro!');

    const isSpotify = query.includes('spotify.com');
    const isYoutube = query.includes('youtube.com') || query.includes('youtu.be');
    const emoji     = isSpotify ? '🟢' : isYoutube ? '🔴' : '🔍';
    const label     = isSpotify ? 'Spotify' : isYoutube ? 'YouTube' : 'Buscando';

    await interaction.editReply(emoji + ' ' + label + ': **' + query + '**...');

    const track = await searchTrack(query, member.displayName).catch(() => null);
    if (!track) return interaction.editReply('Nao encontrei nada para: **' + query + '**\n> Tente o nome da musica, ex: `/tocar Shape of You`');

    const guildId = interaction.guildId;
    let queue     = client.musicQueues.get(guildId);

    // Limpa fila se bot foi desconectado
    if (queue) {
      const status = queue.connection?.state?.status;
      if (status === VoiceConnectionStatus.Destroyed || status === VoiceConnectionStatus.Disconnected) {
        interaction.channel.send('Voxara foi desconectado. Entrando novamente...');
        queue.destroy();
        client.musicQueues.delete(guildId);
        queue = null;
      }
    }

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id, guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false, selfMute: false,
      });

      connection.on('error', err => console.error('Voz erro:', err.message));

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        const q = client.musicQueues.get(guildId);
        if (q) {
          q.textChannel.send('Voxara foi desconectado. Use `/tocar` para chamar novamente!');
          q.destroy();
        }
        client.musicQueues.delete(guildId);
      });

      queue = new MusicQueue(guildId, connection, interaction.channel);
      client.musicQueues.set(guildId, queue);
      startVoiceRecognition(connection, client, guildId, interaction.channel);

      interaction.channel.send(
        'Voxara entrou no canal!\n> Fale **"musica"** + comando:\n> *"musica pausar"* • *"musica pular"* • *"musica tocar [nome]"*'
      );
    }

    await queue.addTrack(track);

    if (queue.current?.url !== track.url) {
      await interaction.editReply('**' + track.title + '** adicionada a fila! | ' + track.duration + ' | Posicao: ' + queue.tracks.length);
    } else {
      await interaction.editReply('Tocando agora: **' + track.title + '**');
    }
  },
};