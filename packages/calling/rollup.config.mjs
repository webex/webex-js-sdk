import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist/esm',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].js',
  },
  external: [
    '@webex/internal-media-core',
    '@webex/internal-plugin-metrics',
    '@webex/media-helpers',
    'events',
    'uuid',
    'buffer',
    'platform',
    'async-mutex',
    'xstate',
  ],
  plugins: [
    resolve({
      extensions: ['.ts', '.js'],
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      useTsconfigDeclarationDir: true,
      tsconfigOverride: {
        compilerOptions: {
          declaration: true,
          declarationDir: 'dist/types',
          outDir: 'dist/esm',
        },
        exclude: ['**/*.test.ts', 'node_modules'],
      },
    }),
  ],
};
