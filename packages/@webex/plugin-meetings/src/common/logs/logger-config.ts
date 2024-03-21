const LoggerConfig: any = {};

LoggerConfig.set = (options) => {
  LoggerConfig.verboseEvents = options.verboseEvents;
  LoggerConfig.enable = options.enable;
};

export default LoggerConfig;
