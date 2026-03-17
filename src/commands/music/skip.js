const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula para a próxima música.'),
  cooldownMs: 2000,
  async execute(interaction, client) {
    const ok = client.player.skip(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há música para pular.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('⏭️ Pulado', 'Pulando para a próxima música.')] });
  },
};
