const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('anterior').setDescription('Volta para a música anterior do histórico.'),
  async execute(interaction, client) {
    const previous = client.player.previous(interaction.guildId);
    if (!previous) {
      await interaction.reply({
        embeds: [EmbedFactory.warning('Sem histórico', 'Não existe música anterior para esta sessão.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [EmbedFactory.success('⏮️ Voltando', `Voltando para: **${previous.name}**`)],
    });
  },
};
