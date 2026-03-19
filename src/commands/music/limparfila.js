const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('limparfila').setDescription('Limpa todas as músicas pendentes da fila.'),
  async execute(interaction, client) {
    const cleared = client.player.clear(interaction.guildId);
    if (!cleared) {
      await interaction.reply({
        embeds: [EmbedFactory.warning('Fila já está limpa', 'Não há músicas pendentes para remover.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [EmbedFactory.success('🧹 Fila limpa', 'Mantive apenas a música atual e removi o restante da fila.')],
    });
  },
};
