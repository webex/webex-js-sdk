/* eslint-disable @typescript-eslint/no-unused-vars */
import LoggerConfig from './logger-config';

const LoggerProxy: any = {
  logger: {
    info: () => {
      console.error('LoggerProxy->info#NO LOGGER DEFINED');
    },
    log: () => {
      console.error('LoggerProxy->log#NO LOGGER DEFINED');
    },
    error: () => {
      console.error('LoggerProxy->error#NO LOGGER DEFINED');
    },
    warn: () => {
      console.error('LoggerProxy->warn#NO LOGGER DEFINED');
    },
    trace: () => {
      console.error('LoggerProxy->trace#NO LOGGER DEFINED');
    },
    debug: () => {
      console.error('LoggerProxy->debug#NO LOGGER DEFINED');
    },
  },
};

LoggerProxy.set = (logger: unknown) => {
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
