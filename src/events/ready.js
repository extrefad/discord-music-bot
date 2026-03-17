module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    client.logger.info(`Bot iniciado como ${client.user.tag}`);
    client.logger.info(`Conectado em ${client.guilds.cache.size} servidores`);
    client.user.setActivity('/play | Jockie-like local host');
  },
};
