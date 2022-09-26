import http from 'http';

import {build, serve} from 'esbuild';
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
import {esbuildPlugin} from '@web/dev-server-esbuild';
// import envFilePlugin from 'esbuild-envfile-plugin';
import {commonjs} from '@hyrious/esbuild-plugin-commonjs';
import {nodeBuiltIns} from "esbuild-node-builtins";
import { nodePolyfills } from "esbuild-plugin-polyfill-node";
import NodeModulesPolyfills from '@esbuild-plugins/node-modules-polyfill'

// https:// github.com/evanw/esbuild/issues/90
(async () => {
// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
  await import('dotenv')
    .then((module) => module.config({debug: true}));
  // const entryPoints = await glob('./packages/**/src/index.js');

  const ESM_REQUIRE_SHIM = `
await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  /**
   * Shim entry-point related paths.
   */
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  /**
   * Shim require if needed.
   */
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;

/** Whether or not you're bundling. */
const bundle = true;

/** Tell esbuild to add the shim to emitted JS. */
const shimBanner = {
  "js": ESM_REQUIRE_SHIM
};


  
  await build({
    entryPoints: ['./packages/webex/src/webex.js'],
    bundle: true,
    format: 'iife',
    minify: false,
    platform: 'node',
    sourcemap: true,
    target: "chrome100",
    plugins: [ babel(),nodePolyfills(), commonjs()],
    tsconfig: './tsconfig.json',
    external: ['require', 'fs', 'path', 'os', 'https', 'gm', 'stream', 'crypto', 'buffer', 'file-type', 'util','emitter'],
    outfile: './samples/bundle.js',
    inject: ['./process-shim.js'],
    define: {PACKAGE_VERSION: 'false', global: 'window'},
    // banner: bundle ? shimBanner : undefined,
  }).catch((error) => {
    console.error(" ERROR" , error);
  });

  await serve({
    servedir: './samples',
  },{})
  .catch((error) => {
    console.error("SERVER ERROR",error);
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
