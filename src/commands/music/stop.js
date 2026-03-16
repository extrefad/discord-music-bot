const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Para o player e limpa a fila.'),
  async execute(interaction, client) {
    const ok = client.player.stop(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há fila ativa para parar.')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('⏹️ Player parado', 'Fila limpa com sucesso.')] });
  },
};
