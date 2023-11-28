const cli = {
  bundle: true,
  entryPoints: [
    './src/main.ts',
  ],
  format: 'cjs',
  minify: true,
  outfile: './dist/cli/index.js',
  platform: 'node',
  sourcemap: true,
  target: ['node16'],
};

module.exports = cli;
