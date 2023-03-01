const config = (jasmine, overrides) => {
  jasmine.loadConfig({
    env: {
      failSpecWithNoExpectations: false,
      stopSpecOnExpectationFailure: false,
      stopOnSpecFailure: false,
      random: false,
    },
    ...overrides,
  });
};

module.exports = config;
