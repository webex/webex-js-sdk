import {build} from 'esbuild';
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import  alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
// https:// github.com/evanw/esbuild/issues/90
(async () => {
  // const entryPoints = await glob('./packages/**/src/index.js');

  const entryPoints = [
    'packages/@webex/common/src/index.js',
    'packages/@webex/webex-core/src/index.js'
  ];

  console.log(entryPoints);
  await build({
    entryPoints,
    bundle: true,
    format: 'cjs',
    minify: true,
    sourcemap: true,
    platform: 'node',
    plugins: [babel()],
    tsconfig: './tsconfig.json',
    external: ['require', 'fs', 'path', 'os', 'https'],
    outdir: './bundle',
  });
})();
