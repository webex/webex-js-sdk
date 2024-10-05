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
        required: false,
        type: 'example-option-type-a',
      },
      {
        alias: 'example-option-alias-b',
        default: 'example-option-default-b',
        description: 'example-option-description-b',
        name: 'example-option-name-b',
        required: false,
        type: 'example-option-type-b',
      },
      {
        alias: 'example-option-alias-c',
        default: 'example-option-default-c',
        description: 'example-option-description-c',
        name: 'example-option-name-c',
        required: true,
        type: 'example-option-type-c',
      },
    ],
  },
  handler: () => Promise.resolve(),
});

module.exports = {
  generateCommandFixture,
};
