const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Mostra latência do bot.'),
  async execute(interaction, client) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply({
      embeds: [
        EmbedFactory.success('🏓 Pong', `Gateway: **${client.ws.ping}ms**\nResposta: **${latency}ms**`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
