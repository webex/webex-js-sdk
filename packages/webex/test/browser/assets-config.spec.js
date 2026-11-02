/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

const fs = require('fs');
const {createRequire} = require('module');
const os = require('os');
const path = require('path');
const {assert} = require('@webex/test-helper-chai');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const requireRoot = createRequire(path.join(repositoryRoot, 'package.json'));
const webpack = requireRoot('webpack');
const {test} = requireRoot('@playwright/test');
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'umd',
  'test',
  'docs',
  'ai-docs',
  '.sdd',
  '.coverage',
]);

function stageBuildInputs(directory, sdkVersion) {
  fs.cpSync(path.join(repositoryRoot, 'packages'), path.join(directory, 'packages'), {
    recursive: true,
    filter: (source) =>
      !excludedDirectories.has(path.basename(source)) && !path.basename(source).startsWith('.env'),
  });
  ['webpack.config.js', 'babel.config.json'].forEach((file) => {
    fs.copyFileSync(path.join(repositoryRoot, file), path.join(directory, file));
  });
  fs.mkdirSync(path.join(directory, 'tooling'));
  fs.copyFileSync(
    path.join(repositoryRoot, 'tooling/babel-plugin-inject-package-version.js'),
    path.join(directory, 'tooling/babel-plugin-inject-package-version.js')
  );

  // Preserve workspace resolution inside the fixture, including the legacy Babel injector.
  const linkDependency = (name) => {
    const source = path.join(repositoryRoot, 'node_modules', name);
    const relative = path.relative(repositoryRoot, fs.realpathSync(source));
    const staged = path.join(directory, relative);
    const target =
      relative.startsWith(`packages${path.sep}`) && fs.existsSync(staged) ? staged : source;

    fs.mkdirSync(path.dirname(path.join(directory, 'node_modules', name)), {recursive: true});
    fs.symlinkSync(target, path.join(directory, 'node_modules', name), 'junction');
  };

  fs.readdirSync(path.join(repositoryRoot, 'node_modules')).forEach((name) => {
    if (name.startsWith('@')) {
      fs.readdirSync(path.join(repositoryRoot, 'node_modules', name)).forEach((dependency) => {
        linkDependency(`${name}/${dependency}`);
      });
    } else if (!name.startsWith('.')) {
      linkDependency(name);
    }
  });

  const manifestPath = path.join(directory, 'packages/webex/package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  fs.writeFileSync(manifestPath, JSON.stringify({...manifest, version: sdkVersion}));
}

async function buildEncryptionUmd(directory) {
  const previousDirectory = process.cwd();

  process.chdir(directory);
  try {
    // Load the real production entry, version injection, and asset-copy configuration.
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const config = require(path.join(directory, 'webpack.config.js'))({
      NODE_ENV: 'production',
      umd: true,
    });

    config.entry = {encryption: config.entry.encryption};
    config.output.path = path.join(directory, 'build');

    const compiler = webpack(config);

    return await new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        compiler.close((closeError) => {
          if (error || closeError) {
            reject(error || closeError);
          } else if (stats.hasErrors()) {
            reject(new Error(stats.toString({all: false, errors: true})));
          } else {
            resolve(stats);
          }
        });
      });
    });
  } finally {
    process.chdir(previousDirectory);
  }
}

[
  {
    name: 'versioned release',
    version: '3.12.0-test.5315',
    expectedUrl: 'https://unpkg.com/webex@3.12.0-test.5315/umd/assets/internal-plugin-encryption/',
  },
  {
    name: 'unversioned build',
    version: '0.0.0',
    expectedUrl: '/assets/internal-plugin-encryption/',
  },
].forEach(({name, version, expectedUrl}) => {
  test(`uses the encryption asset default from the ${name} UMD`, async ({page}, testInfo) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webex-umd-assets-'));

    try {
      stageBuildInputs(directory, version);
      const stats = await buildEncryptionUmd(directory);

      await testInfo.attach('webpack-build', {
        body: stats.toString({all: false, assets: true, warnings: true}),
        contentType: 'text/plain',
      });

      const unexpectedRequests = [];
      const applicationUrl = 'http://localhost/sdk-assets-test';

      await page.route('**/*', (route) => {
        if (route.request().url() === applicationUrl) {
          return route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><title>SDK assets</title>',
          });
        }
        unexpectedRequests.push(route.request().url());

        return route.abort();
      });
      await page.goto(applicationUrl);
      await page.addScriptTag({
        path: path.join(directory, 'build/packages/webex/umd/encryption.min.js'),
      });

      const overrideUrl = 'https://application.example/sdk/encryption/';
      const actual = await page.evaluate(async (assetsBaseUrl) => {
        const config = {
          logger: {level: 'silent'},
          services: {skipPreauthCatalogOnUnauthenticated: true},
        };
        const sdk = window.Webex.init({config});
        const overridden = window.Webex.init({
          config: {...config, encryption: {assetsBaseUrl}},
        });

        return {
          assetsBaseUrl: sdk.config.encryption.assetsBaseUrl,
          pluginAssetsBaseUrl: sdk.internal.encryption.config.assetsBaseUrl,
          overrideUrl: overridden.internal.encryption.config.assetsBaseUrl,
          assetName: sdk.config.encryption.carootsAsset,
          shouldValidateKMSCertificate: sdk.config.encryption.shouldValidateKMSCertificate,
          caroots: await sdk.internal.encryption.kms._getCaroots(),
        };
      }, overrideUrl);

      await testInfo.attach('browser-config', {
        body: JSON.stringify(actual, null, 2),
        contentType: 'application/json',
      });

      const assetsDirectory = path.join(
        repositoryRoot,
        'packages/@webex/internal-plugin-encryption/assets'
      );
      const assets = fs.readdirSync(assetsDirectory).filter((file) => file.endsWith('.p7b'));

      assert.lengthOf(assets, 1);
      assert.deepEqual(actual, {
        assetsBaseUrl: expectedUrl,
        pluginAssetsBaseUrl: expectedUrl,
        overrideUrl,
        assetName: assets[0],
        shouldValidateKMSCertificate: false,
        caroots: undefined,
      });
      assert.deepEqual(
        fs.readFileSync(
          path.join(
            directory,
            'build/packages/webex/umd/assets/internal-plugin-encryption',
            assets[0]
          )
        ),
        fs.readFileSync(path.join(assetsDirectory, assets[0]))
      );
      assert.deepEqual(unexpectedRequests, []);
    } finally {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  });
});
