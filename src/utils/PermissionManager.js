const { PermissionFlagsBits } = require('discord.js');

class PermissionManager {
  static canUseMusicCommand(member) {
    return Boolean(member?.voice?.channelId);
  }

  static canControlBot(member, botMember) {
    const inSameVoice = member?.voice?.channelId && member.voice.channelId === botMember?.voice?.channelId;
    const hasMoveMembers = member?.permissions?.has(PermissionFlagsBits.MoveMembers);
    return Boolean(inSameVoice || hasMoveMembers);
  }
}

module.exports = { PermissionManager };
