const generateCommandFixture = () => ({
  config: {
    name: 'example-command-name',
    description: 'example-command-description',
    options: [
      {
        alias: 'example-option-alias-a',
        default: 'example-option-default-a',
        description: 'example-option-description-a',
        name: 'example-option-name-a',
        type: 'example-option-type-a',
      },
      {
        alias: 'example-option-alias-b',
        default: 'example-option-default-b',
        description: 'example-option-description-b',
        name: 'example-option-name-b',
        type: 'example-option-type-b',
      },
    ],
  },
  handler: () => Promise.resolve(),
});

module.exports = {
  generateCommandFixture,
};

// const optionFixture = {
//   alias: 'e',
//   default: 'hello world',
//   describe: 'example option description',
//   name: 'exampleOption',
//   require: true,
//   type: 'string',
// };

// const configFixture = {
//   options: [
//     optionFixture,
//   ],
// };

// const parseSyncFixture = {
//   [optionFixture.name]: optionFixture.default,
// };

// const fixtures = {
//   configFixture,
//   optionFixture,
//   parseSyncFixture,
// };

// module.exports = fixtures;
