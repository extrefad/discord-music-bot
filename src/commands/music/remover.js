const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remover')
    .setDescription('Remove uma música específica da fila (sem pular a atual).')
    .addIntegerOption((opt) => opt.setName('posicao').setDescription('Posição na fila (1 = próxima música).').setRequired(true).setMinValue(1)),
  async execute(interaction, client) {
    const position = interaction.options.getInteger('posicao', true);
    const removed = client.player.remove(interaction.guildId, position);

    if (!removed) {
      await interaction.reply({
        embeds: [EmbedFactory.warning('Não foi possível remover', 'Posição inválida ou fila curta demais.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [EmbedFactory.success('🗑️ Música removida', `Faixa removida da fila: **${removed.name}**`)],
    });
  },
};
