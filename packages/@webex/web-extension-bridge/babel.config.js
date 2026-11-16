// The bridge only ever runs in a Chromium MV3 context, so the build targets the
// manifest's `minimum_chrome_version` instead of the repo-wide legacy browser matrix.
// `@babel/plugin-transform-runtime` is deliberately absent: it would add a
// `@babel/runtime` runtime dependency and NFR1 requires zero runtime dependencies.
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: '116',
          node: '18',
        },
      },
    ],
    '@babel/preset-typescript',
  ],
  sourceMaps: true,
};
