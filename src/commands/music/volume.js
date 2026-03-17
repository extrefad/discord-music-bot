const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume do player.')
    .addIntegerOption((opt) => opt.setName('nivel').setDescription('Valor entre 1 e 150').setRequired(true).setMinValue(1).setMaxValue(150)),
  cooldownMs: 2000,
  async execute(interaction, client) {
    const value = interaction.options.getInteger('nivel', true);
    const ok = client.player.setVolume(interaction.guildId, value);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Inicie uma música antes de ajustar volume.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('🔊 Volume atualizado', `Novo volume: **${value}%**`)] });
  },
};
