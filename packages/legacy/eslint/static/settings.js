const settings = {
  'import/core-modules': ['chai', 'sinon'],
  'import/resolver': {
    node: {
      extensions: ['.js', '.ts'],
      paths: ['src'],
    },
  },
  typescript: {},
};

module.exports = settings;
