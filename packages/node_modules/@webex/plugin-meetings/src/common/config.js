const StaticConfig = {};

StaticConfig.set = (options) => {
  const values = {};

  StaticConfig.meetings = Object.assign(values, options);
};

export default StaticConfig;
