/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {MemoryStoreAdapter, WebexHttpError} from '@webex/webex-core';
import makeLocalUrl from '@webex/test-helper-make-local-url';

describe('webex-core', function () {
  this.timeout(30000);
  describe('Webex', () => {
    describe('#request()', () => {
      let webex;

      before(() => {
        webex = new WebexCore();
      });

      it('adds a tracking id to each request', () =>
        webex
          .request({
            uri: makeLocalUrl('/'),
            headers: {
              authorization: false,
            },
          })
          .then((res) => {
            assert.property(res.options.headers, 'trackingid');
            // pattern is "webex-js-sdk", "uuid", "sequence number" joined with
            // underscores
            assert.match(
              res.options.headers.trackingid,
              /webex-js-sdk_[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}_\d+/
            );
          }));

      it('adds a spark-user-agent id to each request', () =>
        webex
          .request({
            uri: makeLocalUrl('/'),
            headers: {
              authorization: false,
            },
          })
          .then((res) => {
            assert.property(res.options.headers, 'spark-user-agent');
          }));

      it('fails with a WebexHttpError', () =>
        assert
          .isRejected(
            webex.request({
              uri: makeLocalUrl('/not-a-route'),
              headers: {
                authorization: false,
              },
              body: {
                proof: true,
              },
            })
          )
          .then((err) => {
            assert.instanceOf(err, WebexHttpError);
            assert.instanceOf(err, WebexHttpError.BadRequest);

            assert.property(err, 'options');
            assert.property(err.options, 'body');
            assert.property(err.options.body, 'proof');
            assert.isTrue(err.options.body.proof);
          }));
    });

    describe('#logout()', () => {
      let onBeforeLogoutFailedSpy, onBeforeLogoutSpy, webex;

      beforeEach(() => {
        onBeforeLogoutSpy = sinon.stub().returns(() => Promise.resolve());
        onBeforeLogoutFailedSpy = sinon.stub().returns(() => Promise.reject());
        // FIXME there may be a bug where initializing the sdk with credentials,
        // device, etc, doesn't write those values to the store.
        webex = new WebexCore({
          config: {
            storage: {
              boundedAdapter: MemoryStoreAdapter.preload({
                Credentials: {
                  '@': {
                    supertoken: {
                      // eslint-disable-next-line camelcase
                      access_token: 'AT',
                    },
                  },
                },
              }),
            },
            onBeforeLogout: [
              {
                plugin: 'credentials',
                fn: onBeforeLogoutSpy,
              },
              {
                plugin: 'mercury',
                fn: onBeforeLogoutFailedSpy,
              },
            ],
          },
        });

        sinon.spy(webex.boundedStorage, 'clear');
        sinon.spy(webex.unboundedStorage, 'clear');

        return new Promise((resolve) => webex.once('ready', resolve)).then(() => {
          const {supertoken} = webex.credentials;

          sinon.stub(webex.credentials.supertoken, 'revoke').callsFake(() => {
            supertoken.unset('access_token');

            return Promise.resolve();
          });
        });
      });

      it('invokes onBeforeLogout handlers', () =>
        webex.logout().then(() => {
          assert.called(onBeforeLogoutSpy);
          assert.called(onBeforeLogoutFailedSpy);
        }));

      it('invalidates all tokens', () =>
        webex.logout().then(() => {
          assert.calledOnce(webex.boundedStorage.clear);
          assert.calledOnce(webex.unboundedStorage.clear);
        }));

      it('clears all stores', () =>
        webex.boundedStorage
          .get('Credentials', '@')
          .then((data) => {
            assert.isDefined(data.supertoken);
            assert.equal(data.supertoken.access_token, 'AT');

            return webex.logout();
          })
          .then(() => assert.isRejected(webex.boundedStorage.get('Credentials', '@'))));

      it('executes logout actions in the correct order', () =>
        webex.boundedStorage
          .get('Credentials', '@')
          .then((data) => {
            assert.isDefined(data.supertoken);
            assert.equal(data.supertoken.access_token, 'AT');

            return webex.logout();
          })
          .then(() => assert.called(onBeforeLogoutSpy))
          .then(() => {
            assert.calledOnce(webex.boundedStorage.clear);
            assert.calledOnce(webex.unboundedStorage.clear);
          })
          .then(() => assert.isRejected(webex.boundedStorage.get('Credentials', '@'))));

      it('logs out gracefully even if token does not exist', () => {
        webex.credentials.supertoken = undefined;

        return webex
          .logout()
          .then(() => {
            assert.called(onBeforeLogoutSpy);
            assert.called(onBeforeLogoutFailedSpy);
          })
          .then(() => {
            assert.calledOnce(webex.boundedStorage.clear);
            assert.calledOnce(webex.unboundedStorage.clear);
          });
      });
    });
  });
});
