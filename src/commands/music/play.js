const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');
const { ensureVoice } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música por nome ou link (YouTube/Spotify).')
    .addStringOption((opt) => opt.setName('busca').setDescription('Nome da música ou link').setRequired(true)),
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

      const detalhe = result?.mode === 'fallback'
        ? '\n⚠️ Reprodução em modo de contingência (play-dl).'
        : '';

      await interaction.editReply({
        embeds: [EmbedFactory.success('✅ Adicionado à fila', `Busca: **${query}**${detalhe}`)],
      });
    } catch (error) {
      client.logger.error('Falha no /tocar', { error: error?.message || 'Erro desconhecido' });
      await interaction.editReply({
        embeds: [
          EmbedFactory.error(
            '❌ Não foi possível tocar',
            'Não consegui reproduzir esse link/busca agora. Tente outro vídeo, outro termo ou repita em alguns segundos.',
          ),
        ],
      });
    }
  },
};
