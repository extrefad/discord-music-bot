const { EmbedFactory } = require('../../utils/EmbedBuilder');
const { PermissionManager } = require('../../utils/PermissionManager');

async function ensureVoice(interaction) {
  if (!PermissionManager.canUseMusicCommand(interaction.member)) {
    await interaction.reply({ embeds: [EmbedFactory.warning('Canal de voz', 'Entre em um canal de voz para usar comandos de música.')], ephemeral: true });
    return null;
  }
  return interaction.member.voice.channel;
}

module.exports = { ensureVoice };
