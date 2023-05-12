import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import versionPlugin from './versionPlugin';

const basePlugins = [
  commonjs(),
  nodePolyfills({include: ['events']}),
  typescript({useTsconfigDeclarationDir: true}),
  resolve({browser: true, extensions: ['.js', '.ts'], preferBuiltins: true}),
  json(),
  versionPlugin(),
];

export default {
  input: 'src/Hooks/hook.ts',
  output: [
    {format: 'umd', name: 'Calling', dir: 'dist/umd'},
    {
      file: 'samples/index.min.js',
      format: 'iife',
      name: 'Calling',
      intro: 'const global = window;',
    },
  ],
  plugins: basePlugins,
  watch: {include: 'src/**'},
};
