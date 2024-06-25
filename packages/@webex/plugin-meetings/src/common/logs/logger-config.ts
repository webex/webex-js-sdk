const LoggerConfig: any = {};

LoggerConfig.set = (options: Record<string, any>) => {
  LoggerConfig.verboseEvents = options.verboseEvents;
  LoggerConfig.enable = options.enable;
};

export default LoggerConfig;
