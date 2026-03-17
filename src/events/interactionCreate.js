const { MessageFlags } = require('discord.js');
const { EmbedFactory } = require('../utils/EmbedBuilder');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const cooldown = client.cooldowns.hit(
      command.data.name,
      interaction.user.id,
      interaction.guildId,
      command.cooldownMs || 0,
    );

    if (!cooldown.allowed) {
      await interaction.reply({
        embeds: [
          EmbedFactory.warning(
            'Cooldown ativo',
            `Aguarde **${(cooldown.retryAfterMs / 1000).toFixed(1)}s** para usar /${command.data.name} novamente.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      client.logger.error(`Erro no comando /${command.data.name}`, { error: error.message });
      const payload = { embeds: [EmbedFactory.error('Erro', 'Ocorreu um erro ao executar o comando.')] };
      if (interaction.deferred || interaction.replied) await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  },
};
