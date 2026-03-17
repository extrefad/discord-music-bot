const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('sair').setDescription('Desconecta o bot do canal de voz.'),
  async execute(interaction, client) {
    const ok = client.player.disconnect(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Sem conexão', 'O bot não está conectado a um canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('👋 Desconectado', 'Conexão de voz encerrada.')] });
  },
};
