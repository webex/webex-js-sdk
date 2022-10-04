
import LoggerProxy from './src/common/logs/logger-proxy';
import LoggerConfig from './src/common/logs/logger-config';

const logger = {
  info: () => {},
  log: () => {},
  error: () => {},
  warn: () => {},
  trace: () => {},
  debug: () => {}
};

LoggerConfig.set({verboseEvents: true, enable: false});
LoggerProxy.set(logger);
