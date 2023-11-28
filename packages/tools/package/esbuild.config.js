const esbuild = require('esbuild');

const { cli } = require('@webex/esbuild-config');

const definition = require('./package.json');

esbuild.buildSync({
  ...cli,
  ...{ external: Object.keys(definition.dependencies) },
});
