const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Mostra a música atual.'),
  async execute(interaction, client) {
    const song = client.player.getNowPlaying(interaction.guildId);
    if (!song) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Nada tocando', 'Não há música em reprodução.')], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [EmbedFactory.nowPlaying(song, interaction.user.toString())] });
  },
};
