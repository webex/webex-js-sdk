/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {updated} = require(`../lib/updated`);
const wrapHandler = require(`../lib/wrap-handler`);
const {list} = require(`../util/package`);

module.exports = {
  command: `list`,
  desc: `List packages`,
  builder: {
    fortests: {
      default: false,
      description: `list packages that should be tested in CI`,
      type: `boolean`
    },
    forpipeline: {
      default: false,
      description: `list packages that should be tested in a pipeline gating job`,
      type: `boolean`
    }
  },
  // eslint-disable-next-line complexity
  handler: wrapHandler(async ({fortests, forpipeline}) => {
    let packages;
    if (fortests) {
      const changed = await updated({});
      if (changed.includes(`tooling`)) {
        packages = await list();
      }
      else {
        packages = await updated({dependents: true});
      }
      // We don't want to run legacy tests in validated merge
      packages = packages.filter((p) => p !== `legacy`);
    }
    else {
      packages = await list();
      if (forpipeline) {
        packages.push(`legacy`);
      }
    }

    if (forpipeline || fortests) {
      if (packages.includes(`legacy`)) {
        packages = packages.filter((p) => p !== `legacy`);
        packages.push(`legacy-node`);
        packages.push(`legacy-browser`);
      }

      packages = packages
        .filter((p) => !p.includes(`bin-`))
        .filter((p) => !p.includes(`test-helper-`))
        .filter((p) => !p.includes(`eslint-config`))
        .filter((p) => !p.includes(`xunit-with-logs`));

      // this array is ranked in the order of approximate slowness. At this
      // time, that order is based on eyeballing some xml files rather than
      // empirical measurements of overall suite duration.
      const slow = [
        `@ciscospark/media-engine-webrtc`,
        `@ciscospark/plugin-phone`,
        `@ciscospark/internal-plugin-conversation`,
        `ciscospark`,
        `@ciscospark/plugin-authorization-browser`
      ];

      packages.sort((a, b) => {
        const aIsSlow = slow.includes(a);
        const bIsSlow = slow.includes(b);

        if (aIsSlow === bIsSlow) {
          return slow.indexOf(a) - slow.indexOf(b);
        }

        if (aIsSlow) {
          return -1;
        }

        if (bIsSlow) {
          return 1;
        }

        return 0;
      });
    }

    for (const pkg of packages) {
      console.info(pkg);
    }
  })
};
