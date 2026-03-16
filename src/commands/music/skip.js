const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Pula para a próxima música.'),
  cooldownMs: 2000,
  async execute(interaction, client) {
    const ok = client.player.skip(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há música para pular.')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('⏭️ Skip', 'Pulando para a próxima música.')] });
  },
};
