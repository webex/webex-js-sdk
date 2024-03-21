/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-search';

import {assert} from '@webex/test-helper-chai';
import WebexCore, {WebexHttpError} from '@webex/webex-core';
import fh from '@webex/test-helper-file';
import testUsers from '@webex/test-helper-test-users';

require('@webex/internal-plugin-support');

const {TooManyRequests} = WebexHttpError;

describe('plugin-support', function () {
  this.timeout(60000);

  let webex;

  let sampleTextOne = 'sample-text-one.txt';

  before('fetch fixtures', () =>
    Promise.all([fh.fetch(sampleTextOne)]).then((res) => {
      [sampleTextOne] = res;
    })
  );

  // Disabled because rackspace is broken
  describe('#submitLogs()', () => {
    describe('when the current user is authorized', () => {
      before(() =>
        testUsers.create({count: 1}).then((users) => {
          webex = new WebexCore({
            credentials: {
              authorization: users[0].token,
            },
          });

          return webex.internal.device.register();
        })
      );

      it('uploads logs', () =>
        webex.internal.support
          .submitLogs({}, sampleTextOne)
          .then((body) => {
            assert.isDefined(body);
            assert.property(body, 'url');
            assert.property(body, 'userId');
            assert.equal(body.userId, webex.internal.device.userId);
          })
          // Atlas has a really unfortunate rate limit in place, so we're going
          // to rely on hope that enough of the node/browser runs don't get rate
          // limited to prove this code works.
          .catch((err) => {
            if (err instanceof TooManyRequests) {
              return;
            }

            throw err;
          }));
    });
  });
});
