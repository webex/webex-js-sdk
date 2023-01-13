/* eslint-disable no-unused-vars */
import LoggerConfig from './logger-config';

const LoggerProxy: any = {
  logger: {
    info: (args) => {
      console.error('LoggerProxy->info#NO LOGGER DEFINED');
    },
    log: (args) => {
      console.error('LoggerProxy->log#NO LOGGER DEFINED');
    },
    error: (args) => {
      console.error('LoggerProxy->error#NO LOGGER DEFINED');
    },
    warn: (args) => {
      console.error('LoggerProxy->warn#NO LOGGER DEFINED');
    },
    trace: (args) => {
      console.error('LoggerProxy->trace#NO LOGGER DEFINED');
    },
    debug: (args) => {
      console.error('LoggerProxy->debug#NO LOGGER DEFINED');
    },
  },
};

LoggerProxy.set = (logger) => {
  if (!LoggerConfig.enable) {
    LoggerProxy.logger = {
      info: () => {},
      log: () => {},
      error: () => {},
      warn: () => {},
      trace: () => {},
      debug: () => {},
    };
  } else {
    LoggerProxy.logger = logger;
  }
};

LoggerProxy.get = () => LoggerProxy.logger;

export default LoggerProxy;
