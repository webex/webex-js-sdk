const StaticConfig: any = {};

StaticConfig.set = (options: any) => {
  const values = {};

  StaticConfig.meetings = Object.assign(values, options);
};

export default StaticConfig;
