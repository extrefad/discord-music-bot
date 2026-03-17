const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('retomar').setDescription('Retoma a reprodução pausada.'),
  async execute(interaction, client) {
    const ok = client.player.resume(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há música pausada.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('▶️ Retomado', 'A reprodução foi retomada.')] });
  },
};
