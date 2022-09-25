import {build} from 'esbuild';
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
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
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    platform: 'node',
    tsconfig: './tsconfig.json',
    external: ['require', 'fs', 'path', 'os', 'https', 'gm'],
    outdir: 'dist',
    outbase: './packages'
  });
})();
