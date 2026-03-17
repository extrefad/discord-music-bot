const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa a reprodução atual.'),
  async execute(interaction, client) {
    const ok = client.player.pause(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há música tocando.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('⏸️ Pausado', 'A reprodução foi pausada.')] });
  },
};
