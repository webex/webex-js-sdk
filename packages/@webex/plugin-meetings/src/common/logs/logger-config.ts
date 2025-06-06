const LoggerConfig: any = {};

LoggerConfig.set = (options: any) => {
  LoggerConfig.verboseEvents = options.verboseEvents;
  LoggerConfig.enable = options.enable;
};

export default LoggerConfig;
