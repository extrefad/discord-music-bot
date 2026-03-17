const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

const modeLabels = {
  desativado: 'Desativado',
  musica: 'Música atual',
  fila: 'Fila',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('repetir')
    .setDescription('Define o modo de repetição.')
    .addStringOption((opt) =>
      opt
        .setName('modo')
        .setDescription('Modo da repetição')
        .setRequired(true)
        .addChoices(
          { name: 'Desativado', value: 'desativado' },
          { name: 'Música', value: 'musica' },
          { name: 'Fila', value: 'fila' },
        ),
    ),
  async execute(interaction, client) {
    const mode = interaction.options.getString('modo', true);
    const value = client.player.setLoop(interaction.guildId, mode);
    if (value === null) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Inicie uma música antes de alterar repetição.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('🔁 Repetição', `Modo alterado para **${modeLabels[mode]}**.`)] });
  },
};
