/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const pkgUp = require(`pkg-up`);
const t = require(`babel-types`);
/**
 * Uses pkgUp to find the appropriate package.json for the specified babel state
 * object
 * @param {Object} state
 * @private
 * @returns {string}
 */
function versionFromState(state) {
  // eslint-disable-next-line global-require
  return require(pkgUp.sync(state.file.opts.filename)).version;
}

/**
 * Simple babel transform for ensuring that every SparkPlugin (and SparkCore)
 * have the correct version property
 * @returns {Object}
 */
module.exports = function injectPackageVersion() {
  return {
    visitor: {
      CallExpression(path, state) {
        if (t.isMemberExpression(path.get(`callee`))) {

          if (path.node.callee.object.name === `SparkPlugin` && path.node.callee.property.name === `extend`) {
            const def = path.node.arguments[0];
            const visited = def.properties.reduce((acc, p) => acc || t.isObjectProperty(p, {key: `version`}), false);
            if (!visited) {
              def.properties.push(t.objectProperty(
                t.identifier(`version`),
                t.stringLiteral(versionFromState(state))
              ));
            }
          }
        }

      },
      Identifier(path, state) {
        if (path.node.name === `PACKAGE_VERSION`) {
          path.replaceWithSourceString(`\`${versionFromState(state)}\``);
        }
      }
    }
  };
};
