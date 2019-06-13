/* eslint-disable require-jsdoc */
import cleaner from 'rollup-plugin-cleaner';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import {terser} from 'rollup-plugin-terser';
import globals from 'rollup-plugin-node-globals';
import builtins from 'rollup-plugin-node-builtins';
import license from 'rollup-plugin-license';

import {version} from './packages/node_modules/webex/package.json';

export default function ({versionNumber}) {
  return {
    input: `${__dirname}/packages/node_modules/webex/browser.js`,
    output: {
      name: 'Webex',
      file: `${__dirname}/packages/node_modules/webex/umd/webex.min.js`,
      format: 'iife', // since this is for the browser only use IIFE instead of UMD
      sourceMap: true
    },
    plugins: [
      cleaner({
        targets: [`${__dirname}/packages/node_modules/webex/umd/`]
      }),
      json({
        include: ['packages/node_modules/**', 'node_modules/**']
      }),
      resolve({
        jsnext: true,
        browser: true,
        preferBuiltins: true
      }),
      commonjs(),
      globals(),
      builtins(),
      terser(),
      license({
        sourceMap: true,
        banner: `/*! Cisco Spark SDK v${versionNumber || version} */`
      })
    ]
  };
}
