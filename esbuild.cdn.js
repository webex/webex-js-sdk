import http from 'http';

import {build, serve} from 'esbuild';
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
import {esbuildPlugin} from '@web/dev-server-esbuild';

// https:// github.com/evanw/esbuild/issues/90
(async () => {
  // const entryPoints = await glob('./packages/**/src/index.js');
  serve({
    servedir: './samples',
  }, {
    entryPoints: ['./packages/webex/src/webex.js'],
    bundle: true,
    format: 'iife',
    minify: true,
    sourcemap: true,
    target: ['chrome100'],
    plugins: [babel()],
    tsconfig: './tsconfig.json',
    external: ['require', 'fs', 'path', 'os', 'https', 'gm', 'stream', 'crypto'],
    outfile: './samples/bundle.js',
  }).then((server) => {
    console.log('SERVER STARTED', server);
  });

  // //   console.log(entryPoints);
  // await build({
  //   entryPoints: ['./packages/webex/src/webex.js'],
  //   bundle: true,
  //   format: 'iife',
  //   minify: true,
  //   sourcemap: true,
  //   target: ['chrome100'],
  //   plugins: [babel()],
  //   tsconfig: './tsconfig.json',
  //   external: ['require', 'fs', 'path', 'os', 'https', 'gm', 'stream', 'crypto'],
  //   outfile: './samples/webex.min.js',
  // }).catch(() => process.exit(1));

  // serve({
  //   servedir: './samples',
  // }, {
  //   // ... your build options go here ...
  // }).then((result) => {
  //   // The result tells us where esbuild's local server is
  //   const {host, port} = result;

  //   // Then start a proxy server on port 3000
  //   http.createServer((req, res) => {
  //     const options = {
  //       hostname: host,
  //       port,
  //       path: req.url,
  //       method: req.method,
  //       headers: req.headers,
  //     };

  //     // Forward each incoming request to esbuild
  //     const proxyReq = http.request(options, (proxyRes) => {
  //       // If esbuild returns "not found", send a custom 404 page
  //       if (proxyRes.statusCode === 404) {
  //         res.writeHead(404, {'Content-Type': 'text/html'});
  //         res.end('<h1>A custom 404 page</h1>');

  //         return;
  //       }

  //       // Otherwise, forward the response from esbuild to the client
  //       res.writeHead(proxyRes.statusCode, proxyRes.headers);
  //       proxyRes.pipe(res, {end: true});
  //     });

  //     // Forward the body of the request to esbuild
  //     req.pipe(proxyReq, {end: true});
  //   }).listen(3000);
  // });
})();
