const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila atual.'),
  async execute(interaction, client) {
    const queue = client.player.getQueue(interaction.guildId);
    if (!queue || !queue.songs.length) {
      await interaction.reply({ embeds: [EmbedFactory.warning('Fila vazia', 'Nenhuma música na fila.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = queue.songs.slice(0, 10).map((song, index) => {
      if (index === 0) return `**Agora:** ${song.name} (${song.formattedDuration || 'Ao vivo'})`;
      return `**${index}.** ${song.name} (${song.formattedDuration || 'Ao vivo'})`;
    }).join('\n');

    await interaction.reply({
      embeds: [
        EmbedFactory.base('📜 Fila', lines)
          .addFields(
            { name: 'Volume', value: `${queue.volume}%`, inline: true },
            { name: 'Loop', value: `${queue.repeatMode}`, inline: true },
            { name: 'Total', value: `${queue.songs.length} músicas`, inline: true },
            { name: 'Histórico', value: `${queue.historyCount || 0}`, inline: true },
          ),
      ],
    });
  },
};
