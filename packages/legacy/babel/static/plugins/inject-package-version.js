/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

const t = require('@babel/types');
const fs = require('fs');
const pathPack = require('path');

/**
 * Simple babel transform for ensuring that every WebexPlugin (and WebexCore)
 * have the correct version property
 * @returns {Object}
 */
module.exports = function injectPackageVersion() {
  const packagePath = pathPack.resolve(process.cwd(), 'package.json');
  let version = '0.0.0';
  if (fs.existsSync(packagePath)) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const packageJSON = require(packagePath);
    version = packageJSON.version;
  }

  return {
    visitor: {
      /**
       * Adds a version property to all SparkPlugins
       * @param {Object} path
       * @returns {void}
       */
      CallExpression(path) {
        if (t.isMemberExpression(path.get('callee'))) {
          if (
            path.node.callee.object.name === 'WebexPlugin' &&
            path.node.callee.property.name === 'extend'
          ) {
            const def = path.node.arguments[0];
            const visited = def.properties.reduce(
              (acc, p) => acc || t.isObjectProperty(p, {key: 'version'}),
              false
            );

            if (!visited) {
              def.properties.push(
                t.objectProperty(t.identifier('version'), t.stringLiteral(version))
              );
            }
          }
        }
      },
      /**
       * Replaces the PACKAGE_VERSION constant with the current version
       *
       * @param {Object} path
       * @returns {void}
       */
      Identifier(path) {
        if (path.node.name === 'PACKAGE_VERSION') {
          path.replaceWithSourceString(`\`${version}\``);
        }
      },
    },
  };
};
