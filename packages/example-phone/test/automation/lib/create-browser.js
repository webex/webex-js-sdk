/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import FirefoxProfile from 'firefox-profile';
import path from 'path';
import {createBrowser} from '@ciscospark/test-helper-automation';

export default function createFirefoxBrowser(pkg, options) {
  return new Promise((resolve, reject) => {
    FirefoxProfile.copy(path.join(__dirname, `../../../tasks/selenium/linux`), (err, fp) => {
      if (err) {
        reject(err);
        return;
      }

      fp.encode((encoded) => resolve(createBrowser(pkg, Object.assign({
        platform: process.env.SC_TUNNEL_IDENTIFIER ? `mac` : undefined,
        browserName: `firefox`,
        version: `latest`,
        // eslint-disable-next-line camelcase
        firefox_profile: encoded
      }, options))));
    });
  });
}
