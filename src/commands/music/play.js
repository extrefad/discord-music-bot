const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');
const { ensureVoice } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música por nome ou URL (YouTube/Spotify).')
    .addStringOption((opt) => opt.setName('query').setDescription('Nome da música ou URL').setRequired(true)),
  cooldownMs: 3000,
  async execute(interaction, client) {
    const voiceChannel = await ensureVoice(interaction);
    if (!voiceChannel) return;

    await interaction.deferReply();
    const query = interaction.options.getString('query', true);

    await client.player.play({
      voiceChannel,
      textChannel: interaction.channel,
      member: interaction.member,
      query,
    });

    await interaction.editReply({
      embeds: [EmbedFactory.success('✅ Adicionado à fila', `Consulta: **${query}**`)],
    });
  },
};
