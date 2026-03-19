const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pularpara')
    .setDescription('Pula para uma posição específica da fila.')
    .addIntegerOption((opt) => opt.setName('posicao').setDescription('Posição da fila (1 = próxima música).').setRequired(true).setMinValue(1)),
  cooldownMs: 2000,
  async execute(interaction, client) {
    const position = interaction.options.getInteger('posicao', true);
    const target = client.player.skipTo(interaction.guildId, position);

    if (!target) {
      await interaction.reply({
        embeds: [EmbedFactory.warning('Posição inválida', 'Não consegui pular para essa posição da fila.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [EmbedFactory.success('⏭️ Pulando', `Pulando para: **${target.name}**`)],
    });
  },
};
