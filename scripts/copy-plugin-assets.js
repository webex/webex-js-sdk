/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
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
