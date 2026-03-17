module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guildId = oldState.guild.id;
    const queue = client.player.getQueue(guildId);
    if (!queue) return;

    const me = oldState.guild.members.me;
    const botChannelId = me?.voice?.channelId;
    if (!botChannelId) return;

    const channel = oldState.guild.channels.cache.get(botChannelId);
    const nonBotMembers = channel?.members?.filter((member) => !member.user.bot).size || 0;

    if (nonBotMembers === 0) {
      setTimeout(() => {
        const refreshed = oldState.guild.channels.cache.get(botChannelId);
        const users = refreshed?.members?.filter((member) => !member.user.bot).size || 0;
        if (users === 0) {
          client.player.disconnect(guildId);
          client.logger.warn('Canal vazio, desconectando player', { guildId });
        }
      }, client.config.leaveOnEmptyCooldownMs);
    }
  },
};
