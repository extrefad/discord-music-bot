const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Retoma a reprodução pausada.'),
  async execute(interaction, client) {
    const ok = client.player.resume(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Não há música pausada.')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [EmbedFactory.success('▶️ Retomado', 'A reprodução foi retomada.')] });
  },
};
