import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';

const basePlugins = [
  commonjs(),
  nodePolyfills({include: ['events']}),
  typescript({useTsconfigDeclarationDir: true}),
  resolve({browser: true, extensions: ['.js', '.ts'], preferBuiltins: true}),
  json(),
];

export default {
  input: 'src/index.ts',
  output: [
    {
      file: '../../../docs/samples/calling/index.js',
      format: 'umd',
      name: 'Calling',
      intro: 'const global = window;',
    },
  ],
  plugins: basePlugins,
};
