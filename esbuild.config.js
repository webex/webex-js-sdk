import {build} from 'esbuild';
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
import {commonjs} from '@hyrious/esbuild-plugin-commonjs';

// https:// github.com/evanw/esbuild/issues/90
(async () => {
  // const entryPoints = await glob('./packages/**/src/index.js');

  const entryPoints = [
    'packages/@webex/common/src/index.js',
    'packages/@webex/webex-core/src/index.js',
    'packages/@webex/plugin-meetings/src/index.js'
  ];

  // TODO: change the entry point and change to promise , Also move the tsconfig to the plugin meetings
  // TODO: Check the build file

  console.log(entryPoints);
  await build({
    entryPoints,
    bundle: false,
    format: 'esm',
    minify: true,
    sourcemap: true,
    target: 'es6',
    platform: 'node',
    plugins: [babel(), commonjs()],
    tsconfig: './tsconfig.json',
    // external: ['require', 'fs', 'path', 'os', 'https', 'gm'],
    outdir: 'dist',
    outbase: './packages'
  });
})();
