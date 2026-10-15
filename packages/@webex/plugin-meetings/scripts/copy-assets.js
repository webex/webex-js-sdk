/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

const fs = require('fs');
const path = require('path');

const assetsDirectory = path.resolve(__dirname, '../assets');
const distAssetsDirectory = path.resolve(__dirname, '../dist/assets');

fs.mkdirSync(distAssetsDirectory, {recursive: true});
fs.cpSync(assetsDirectory, distAssetsDirectory, {
  recursive: true,
  filter(source) {
    const name = path.basename(source);

    return !name.startsWith('.') && name !== 'README.md' && !name.endsWith('.map');
  },
});
