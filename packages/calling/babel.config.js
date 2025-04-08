const test = process.env.NODE_ENV === 'test';

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [...(test ? ['babel-plugin-transform-import-meta'] : [])],
};
