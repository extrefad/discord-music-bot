const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Lista todos os comandos.'),
  async execute(interaction, client) {
    const commandList = [...client.commands.values()]
      .map((command) => `• **/${command.data.name}** - ${command.data.description}`)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join('\n');

    await interaction.reply({
      embeds: [EmbedFactory.base('📚 Help - Voxara Music', commandList)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
