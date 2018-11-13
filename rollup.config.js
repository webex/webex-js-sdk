// import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import {uglify} from 'rollup-plugin-uglify';
import globals from 'rollup-plugin-node-globals';
import builtins from 'rollup-plugin-node-builtins';
import license from 'rollup-plugin-license';

import {version} from './packages/node_modules/ciscospark/package.json';

export default {
  input: `${__dirname}/packages/node_modules/ciscospark/browser.js`,
  output: {
    name: 'CiscoSpark',
    file: 'umd/ciscospark.min.js',
    format: 'iife', // since this is for the browser only use IIFE instead of UMD
    sourceMap: true
  },
  plugins: [
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
    uglify(),
    license({
      banner: `/*! Cisco Spark SDK v${version} */`
    })
  ]
};
