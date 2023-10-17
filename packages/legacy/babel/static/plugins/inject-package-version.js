/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const t = require('@babel/types');

/**
 * Simple babel transform for ensuring that every WebexPlugin (and WebexCore)
 * have the correct version property
 * @returns {Object}
 */
module.exports = function injectPackageVersion() {
  console.log('pkesari_Version getting injected');
  const version = 'modern';

  return {
    visitor: {
      /**
       * Adds a version property to all SparkPlugins
       * @param {Object} path
       * @returns {void}
       */
      CallExpression(path) {
        if (t.isMemberExpression(path.get('callee'))) {
          console.log('pkesari_CallExpression path');
          if (
            path.node.callee.object.name === 'WebexPlugin' &&
            path.node.callee.property.name === 'extend'
          ) {
            const def = path.node.arguments[0];
            const visited = def.properties.reduce(
              (acc, p) => acc || t.isObjectProperty(p, {key: 'version'}),
              false
            );

            console.log('pkesari_def before visited flag check: ', def, visited);
            if (!visited) {
              console.log('pkesari_Pushing version to def.properties: ', def.properties, version);
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
          console.log('pkesari_replacing version in path: ', path);
          console.log('pkesari_version as per this file: ', version);
          path.replaceWithSourceString(`\`${version}\``);
        }
      },
    },
  };
};
