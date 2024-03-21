/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';

describe('webex', function () {
  this.timeout(60000);
  describe('webex/env', () => {
    browserOnly(it)('does not work in web browsers', () => {
      assert.throws(() => {
        // eslint-disable-next-line
        const webex = require(`webex/env`);
      }, /webex\/env cannot be used in browser environments/);
    });

    nodeOnly(describe)('when WEBEX_ACCESS_TOKEN is set', () => {
      let initialEnvToken;

      before(() =>
        testUsers.create({count: 1}).then(([user]) => {
          initialEnvToken = process.env.WEBEX_ACCESS_TOKEN;
          process.env.WEBEX_ACCESS_TOKEN = user.token.access_token;
        })
      );

      after(() => {
        process.env.WEBEX_ACCESS_TOKEN = initialEnvToken;
      });

      it('exports (commonjs-style) an authorized webex instance', () => {
        // eslint-disable-next-line global-require
        const webex = require('webex/env');

        assert.isTrue(webex.canAuthorize);

        return new Promise((resolve) => webex.once('ready', resolve)).then(() =>
          assert.isTrue(webex.canAuthorize)
        );
      });
    });
  });
});
