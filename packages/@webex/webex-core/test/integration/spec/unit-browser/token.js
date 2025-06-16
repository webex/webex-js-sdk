/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {nodeOnly, browserOnly} from '@webex/test-helper-mocha';
import FakeTimers from '@sinonjs/fake-timers';
import MockWebex from '@webex/test-helper-mock-webex';
import {Token} from '@webex/webex-core';

/* eslint camelcase: [0] */

// eslint-disable-next-line no-empty-function
function noop() {}

describe('webex-core', () => {
  describe('Credentials', () => {
    describe('Token', () => {
      let webex;

      beforeEach(() => {
        webex = new MockWebex();
      });

      function makeToken(options = {}) {
        return new Token(
          Object.assign(
            {
              access_token: 'AT',
              expires_in: 10000,
              token_type: 'Fake',
              refresh_token: 'RT',
              refresh_token_expires_in: 20000,
            },
            options
          ),
          {parent: webex}
        );
      }

      describe('#canRefresh', () => {
        browserOnly(it)('indicates if this token can be refreshed', () => {
          let token = makeToken();

          assert.isFalse(token.canRefresh);
          token.unset('refresh_token');
          assert.isFalse(token.canRefresh);

          webex.config.credentials.refreshCallback = noop;
          token = makeToken();
          assert.isTrue(token.canRefresh);
          token.unset('refresh_token');
          assert.isFalse(token.canRefresh);
        });
      });

      describe('#refresh()', () => {
        browserOnly(it)('refreshes the access_token', () => {
          const token = makeToken();

          webex.config.credentials.refreshCallback = sinon.stub().returns(
            Promise.resolve({
              access_token: 'AT2',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          // FIXME this next line should be necessary. we need a better way to
          // do config
          token.trigger('change:config');

          return token.refresh().then((token2) => {
            assert.equal(token2.access_token, 'AT2');
          });
        });


        browserOnly(it)('revokes the previous token when set', () => {
          const token = makeToken();

          sinon.spy(token, 'revoke');
          webex.config.credentials.refreshCallback = sinon.stub();

          webex.config.credentials.refreshCallback.onCall(0).returns(
            Promise.resolve({
              access_token: 'AT2',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          webex.config.credentials.refreshCallback.onCall(1).returns(
            Promise.resolve({
              access_token: 'AT3',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          // FIXME this next line should be necessary. we need a better way to
          // do config
          token.trigger('change:config');

          return token
            .refresh()
            .then((token2) => {
              assert.isTrue(token.canRefresh);
              assert.notCalled(token.revoke);

              return token2.refresh();
            })
            .then((token3) => {
              assert.equal(token3.access_token, 'AT3');
              assert.called(token.revoke);
            });
        });
      });
    });
  });
});
