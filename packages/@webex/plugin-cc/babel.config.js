module.exports = {
  plugins: ['@webex/babel-config-legacy/inject-package-version'],
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
};
