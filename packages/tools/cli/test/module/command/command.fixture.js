const optionFixture = {
  alias: 'e',
  default: 'hello world',
  describe: 'example option description',
  name: 'exampleOption',
  require: true,
  type: 'string',
};

const configFixture = {
  options: [
    optionFixture,
  ],
};

const parseSyncFixture = {
  [optionFixture.name]: optionFixture.default,
};

const fixtures = {
  configFixture,
  optionFixture,
  parseSyncFixture,
};

module.exports = fixtures;
