/*
 * Stages a plugin's runtime assets into its own dist/ so they ship inside the
 * published npm package (whose entry point is dist/). Runs as each plugin's
 * `build:assets` step (tsc-based build, no webpack), copying assets/ -> dist/assets/
 * and excluding dotfiles, README.md, and source maps.
 *
 * This is required because the plugin packages are built with tsc, not webpack:
 * the SDK's root webpack.config.js only copies assets for the separate UMD bundle
 * (into packages/webex/umd/assets), never into a plugin's dist/. Consumers such as
 * the web app import @webex/<plugin>/dist and copy from dist/assets, so without this
 * step the published package would ship without its runtime assets.
 */

const fs = require('fs');
const path = require('path');

const packageDirectory = process.cwd();
const assetsDirectory = path.join(packageDirectory, 'assets');
const distAssetsDirectory = path.join(packageDirectory, 'dist/assets');

if (!fs.existsSync(assetsDirectory)) {
  throw new Error(`No assets directory found in ${packageDirectory}`);
}

fs.mkdirSync(distAssetsDirectory, {recursive: true});
fs.cpSync(assetsDirectory, distAssetsDirectory, {
  recursive: true,
  filter(source) {
    const name = path.basename(source);

    return !name.startsWith('.') && name !== 'README.md' && !name.endsWith('.map');
  },
});
