import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

const external = [
  '@webex/internal-media-core',
  '@webex/internal-plugin-metrics',
  '@webex/media-helpers',
  'events',
  'uuid',
  'buffer',
  'platform',
  'async-mutex',
  'xstate',
];

const plugins = [
  resolve({
    extensions: ['.ts', '.js'],
  }),
  commonjs(),
  json(),
];

const tsPlugin = (declarationDir, outDir) =>
  typescript({
    tsconfig: './tsconfig.json',
    useTsconfigDeclarationDir: true,
    tsconfigOverride: {
      compilerOptions: {
        declaration: true,
        declarationDir,
        outDir,
      },
      exclude: ['**/*.test.ts', 'node_modules'],
    },
  });

export default [
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    external,
    plugins: [...plugins, tsPlugin('dist/esm/types', 'dist/esm')],
  },
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
      exports: 'auto',
    },
    external,
    plugins: [...plugins, tsPlugin('dist/cjs/types', 'dist/cjs')],
  },
];
