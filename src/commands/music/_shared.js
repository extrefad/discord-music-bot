const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { EmbedFactory } = require('../../utils/EmbedBuilder');
const { PermissionManager } = require('../../utils/PermissionManager');

async function ensureVoice(interaction) {
  if (!PermissionManager.canUseMusicCommand(interaction.member)) {
    await interaction.reply({ embeds: [EmbedFactory.warning('Canal de voz', 'Entre em um canal de voz para usar comandos de música.')], flags: MessageFlags.Ephemeral });
    return null;
  }

  const voiceChannel = interaction.member.voice.channel;
  const botMember = interaction.guild.members.me;
  const perms = voiceChannel.permissionsFor(botMember);

  if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.Speak)) {
    await interaction.reply({
      embeds: [
        EmbedFactory.error(
          'Permissões insuficientes',
          'Eu preciso das permissões **Conectar** e **Falar** nesse canal para tocar áudio.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (voiceChannel.full) {
    await interaction.reply({
      embeds: [EmbedFactory.warning('Canal lotado', 'O canal de voz está lotado e não consigo entrar.')],
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return voiceChannel;
}

module.exports = { ensureVoice };
