module.exports = {
  name: 'error',
  execute(error, client) {
    client.logger.error('Erro no cliente Discord', { error: error.message });
  },
};
