const { Config } = require('./core/Config');
const { Logger } = require('./core/Logger');
const { BotClient } = require('./core/BotClient');

(async () => {
  const logger = new Logger('VOXARA');
  const config = new Config();

  try {
    config.validate();
  } catch (error) {
    logger.error('Falha ao validar configuração', { error: error.message });
    process.exit(1);
  }

  const client = new BotClient({ config, logger });

  try {
    await client.init();
  } catch (error) {
    logger.error('Falha ao iniciar bot', { error: error.message });
    process.exit(1);
  }
})();
