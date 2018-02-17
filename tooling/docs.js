/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */

/**
 * @file docs.js
 * This file builds api docs for every documented package and sticks them in
 * `./docs/api-internal/PACKAGE_NAME`. Documented packages are those all public
 * plugins as well as any package that contains a `toc.yml` file.
 * @example
 * node ./toolings/docs.js
 */

const documentation = require('documentation');
const glob = require('glob');
const yml = require('js-yaml');
const {readFile} = require('mz/fs');
const streamArray = require('stream-array');
const vfs = require('vinyl-fs');

process.on('unhandledRejection', (err) => {
  console.error(err);
  // eslint-disable-next-line no-process-exit
  process.exit(64);
});

(async () => {
  const cwd = './packages/node_modules';

  const packages = glob.sync('**/package.json', {cwd})
    .map((pkg) => pkg.replace('/package.json', ''));

  for (const pkg of packages) {
    const toc = glob.sync('toc.yml', {cwd: `${cwd}/${pkg}`});
    const src = glob.sync(`${cwd}/${pkg}/src/**/*.js`);

    if (toc.length || pkg.startsWith('@ciscospark/plugin-')) {
      const order = toc.length && yml.safeLoad(await readFile(`./${cwd}/${pkg}/${toc[0]}`));

      await (documentation.build(src, {
        toc: order && order.toc
      })
        .then((comments) => documentation.formats.html(comments, {}))
        .then((output) => {
          streamArray(output).pipe(vfs.dest(`docs/api-internal/${pkg}`));
        }));
    }
  }
})();
