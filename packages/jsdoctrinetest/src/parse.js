/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {parse as babelParse} from 'babylon';
import {defaults} from 'lodash';

/**
 * Wrapper around babylon's parse with defaults set
 * @param {string} code
 * @param {object} options
 * @returns {ast}
 */
export default function parse(code, options) {
  return babelParse(code, defaults(options, {
    allowImportExportEverywhere: true,
    sourceType: `module`,
    plugins: [
      `jsx`,
      `flow`,
      `asyncFunctions`,
      `classConstructorCall`,
      `doExpressions`,
      `trailingFunctionCommas`,
      `objectRestSpread`,
      `decorators`,
      `classProperties`,
      `exportExtensions`,
      `exponentiationOperator`,
      `asyncGenerators`,
      `functionBind`,
      `functionSent`
    ]
  }));
}
