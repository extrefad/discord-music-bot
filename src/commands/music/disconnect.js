const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('disconnect').setDescription('Desconecta o bot do canal de voz.'),
  async execute(interaction, client) {
    const ok = client.player.disconnect(interaction.guildId);
    if (!ok) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Sem conexão', 'O bot não está conectado a um canal.')], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.success('👋 Desconectado', 'Conexão de voz encerrada.')] });
  },
};
