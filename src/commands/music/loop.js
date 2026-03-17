const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

const modeLabels = {
  off: 'Desativado',
  song: 'Música atual',
  queue: 'Fila',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Define o modo de loop.')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Modo do loop')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Song', value: 'song' },
          { name: 'Queue', value: 'queue' },
        ),
    ),
  async execute(interaction, client) {
    const mode = interaction.options.getString('mode', true);
    const value = client.player.setLoop(interaction.guildId, mode);
    if (value === null) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Inicie uma música antes de alterar loop.')], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('🔁 Loop', `Modo alterado para **${modeLabels[mode]}**.`)] });
  },
};
