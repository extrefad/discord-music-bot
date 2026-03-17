const LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  MUSIC: 'MUSIC',
};

class Logger {
  constructor(scope = 'BOT') {
    this.scope = scope;
  }

  child(scope) {
    return new Logger(scope);
  }

  format(level, message, extra) {
    const timestamp = new Date().toISOString();
    const payload = extra ? ` ${JSON.stringify(extra)}` : '';
    return `[${timestamp}] [${level}] [${this.scope}] ${message}${payload}`;
  }

  info(message, extra) {
    console.log(this.format(LEVELS.INFO, message, extra));
  }

  warn(message, extra) {
    console.warn(this.format(LEVELS.WARN, message, extra));
  }

  error(message, extra) {
    console.error(this.format(LEVELS.ERROR, message, extra));
  }

  music(message, extra) {
    console.log(this.format(LEVELS.MUSIC, message, extra));
  }
}

module.exports = { Logger, LEVELS };
