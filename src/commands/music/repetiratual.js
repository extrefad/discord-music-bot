const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('repetiratual').setDescription('Recomeça a música atual do início.'),
  async execute(interaction, client) {
    const replayed = client.player.replay(interaction.guildId);
    if (!replayed) {
      await interaction.reply({
        embeds: [EmbedFactory.warning('Nada tocando', 'Não existe música atual para reiniciar.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('🔁 Recomeçando', 'A música atual foi reiniciada.')] });
  },
};
