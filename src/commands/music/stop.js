const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para o player e limpa a fila.'),
  async execute(interaction, client) {
    const ok = client.player.stop(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há fila ativa para parar.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('⏹️ Player parado', 'Fila limpa com sucesso.')] });
  },
};
