const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');
const { ensureVoice } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música por nome, ID ou link (YouTube/Spotify/SoundCloud).')
    .addStringOption((opt) => opt.setName('busca').setDescription('Nome da música, ID ou link').setRequired(true)),
  cooldownMs: 3000,
  async execute(interaction, client) {
    const voiceChannel = await ensureVoice(interaction);
    if (!voiceChannel) return;

    await interaction.deferReply();
    const query = interaction.options.getString('busca', true);

    try {
      const result = await client.player.play({
        voiceChannel,
        textChannel: interaction.channel,
        member: interaction.member,
        query,
      });

      const suffix = result.nowPlaying
        ? '\n▶️ Iniciando reprodução agora.'
        : `\n📌 Entrou na fila na posição **${result.position}**.`;

      const extra = result.addedCount > 1 ? `\n📚 ${result.addedCount} faixa(s) adicionadas.` : '';
      const sourceMessage = result.sourceMessage || 'Reproduzindo via busca';

      await interaction.editReply({
        embeds: [EmbedFactory.success('✅ Música adicionada', `${sourceMessage}\nBusca: **${query}**${suffix}${extra}`)],
      });
    } catch (error) {
      client.logger.error('Falha no /tocar', { error: error?.message || 'Erro desconhecido' });
      await interaction.editReply({
        embeds: [
          EmbedFactory.error(
            '❌ Não foi possível reproduzir',
            'Não foi possível reproduzir. Verifique permissões de voz e tente outro vídeo/termo/link.',
          ),
        ],
      });
    }
  },
};
