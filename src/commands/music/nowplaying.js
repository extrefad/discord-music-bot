const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('tocando').setDescription('Mostra a música atual.'),
  async execute(interaction, client) {
    const song = client.player.getNowPlaying(interaction.guildId);
    if (!song) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Nada tocando', 'Não há música em reprodução.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.nowPlaying(song, interaction.user.toString())] });
  },
};
