const StaticConfig: Record<string, any> = {};

StaticConfig.set = (options: Record<string, any>) => {
  const values: Record<string, any> = {};

  StaticConfig.meetings = Object.assign(values, options);
};

export default StaticConfig;
