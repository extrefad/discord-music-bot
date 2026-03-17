const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Embaralha a fila.'),
  async execute(interaction, client) {
    const ok = client.player.shuffle(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila pequena', 'Adicione mais músicas para embaralhar.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('🔀 Shuffle', 'Fila embaralhada com sucesso.')] });
  },
};
