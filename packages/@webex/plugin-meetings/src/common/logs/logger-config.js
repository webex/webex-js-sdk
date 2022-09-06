
const LoggerConfig = {};

LoggerConfig.set = (options) => {
  LoggerConfig.verboseEvents = options.verboseEvents;
  LoggerConfig.enable = options.enable;
};

export default LoggerConfig;
