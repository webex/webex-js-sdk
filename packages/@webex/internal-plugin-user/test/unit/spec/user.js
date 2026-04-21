/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import UserService from '@webex/internal-plugin-user';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';

describe('plugin-user', () => {
  describe('User', () => {
    let webex, userService;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          user: UserService,
        },
      });

      userService = webex.internal.user;
    });

    describe('#activate()', () => {
      it('requires a `verificationToken` or a confirmationCode + user id', () => {
        assert.isRejected(
          userService.activate(),
          /either options.verificationToken is required or both options.confirmationCode and options.id are required/
        );
      });
    });

    describe('#asUUID()', () => {
      it('requires a `user`', () => assert.isRejected(userService.asUUID(), /`user` is required/));

      it('requires a `user` in the array', () =>
        assert.isRejected(userService.asUUID(['']), /`user` is required/));

      it('requires a valid email', () =>
        assert.isRejected(
          userService.asUUID('not valid email'),
          /Provided user object does not appear to identify a user/
        ));

      it('resolves id if id is passed', () => {
        const id = uuid.v4();

        return userService.asUUID(id).then((res) => {
          assert.equal(res, id);
        });
      });
    });

    describe('#recordUUID()', () => {
      it('requires a `user`', () =>
        assert.isRejected(userService.recordUUID(), /`user` is required/));

      it('requires an `id`', () =>
        assert.isRejected(userService.recordUUID({}), /`user.id` is required/));

      it('requires the `id` to be a uuid', () =>
        assert.isRejected(
          userService.recordUUID({
            id: 'not a uuid',
          }),
          /`user.id` must be a uuid/
        ));

      it('requires an `emailAddress`', () =>
        assert.isRejected(
          userService.recordUUID({
            id: uuid.v4(),
          }),
          /`user.emailAddress` is required/
        ));

      it('requires the `emailAddress` to be a uuid', () =>
        assert.isRejected(
          userService.recordUUID({
            id: uuid.v4(),
            emailAddress: 'not an email address',
          }),
          /`user.emailAddress` must be an email address/
        ));

      it('places the user in the userstore', () => {
        const spy = sinon.stub(userService.store, 'add').returns(Promise.resolve());

        const user = {
          id: uuid.v4(),
          emailAddress: 'test@example.com',
        };

        userService.recordUUID(user);

        assert.calledWith(spy, user);
      });
    });

    describe('#generateOTP()', () => {
      it('requires one of `email` or `id`', () =>
        assert.isRejected(
          userService.generateOTP(),
          /One of `options.email` or `options.id` is required/
        ));
    });

    describe('#validateOTP()', () => {
      it('requires one of `email` or `id` and `oneTimePassword`', () =>
        assert.isRejected(
          userService.validateOTP(),
          /One of `options.email` or `options.id` and `options.oneTimePassword` are required/
        ));
      it('requires one of `email` or `id` even when otp is given', () =>
        assert.isRejected(
          userService.validateOTP({oneTimePassword: '123456'}),
          /One of `options.email` or `options.id` and `options.oneTimePassword` are required/
        ));
      it('requires oneTimePassword even when email is given', () =>
        assert.isRejected(
          userService.validateOTP({email: 'example@test.com'}),
          /One of `options.email` or `options.id` and `options.oneTimePassword` are required/
        ));
      it('requires oneTimePassword even when id is given', () =>
        assert.isRejected(
          userService.validateOTP({id: 'some-fake-id'}),
          /One of `options.email` or `options.id` and `options.oneTimePassword` are required/
        ));
    });

    describe('#setPassword()', () => {
      it('requires a `password`', () =>
        assert.isRejected(userService.setPassword(), /`options.password` is required/));
    });

    describe('#update()', () => {
      it('requires a `displayName`', () =>
        assert.isRejected(userService.update(), /`options.displayName` is required/));
    });

    describe('#updateName()', () => {
      it('requires one of `givenName` `familyName` or `displayName`', () =>
        assert.isRejected(
          userService.updateName(),
          /One of `givenName` and `familyName` or `displayName` is required/
        ));
    });

    describe('#updatePreferredWebexSite()', () => {
      const testUserId = 'test-user-id-1234';
      const testOrgId = 'test-org-id-5678';

      beforeEach(() => {
        webex.internal.device.userId = testUserId;
        webex.credentials.getOrgId = sinon.stub().returns(testOrgId);
        webex.config.credentials.identity = {url: 'https://identity.webex.com'};
      });

      it('rejects when `newSiteUrl` is not provided', () =>
        assert.isRejected(
          userService.updatePreferredWebexSite({}),
          /`options.newSiteUrl` is required/
        ));

      it('rejects when `newSiteUrl` is an empty string', () =>
        assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: ''}),
          /`options.newSiteUrl` is required/
        ));

      it('rejects when device has no userId', () => {
        webex.internal.device.userId = undefined;

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /Device is not registered/
        );
      });

      it('rejects when orgId cannot be determined and none provided', () => {
        webex.credentials.getOrgId = sinon.stub().throws(new Error('no org'));

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /Unable to determine organization ID/
        );
      });

      it('uses provided orgId instead of extracting from credentials', () => {
        const customOrgId = 'custom-org-9999';

        return userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com', orgId: customOrgId})
          .then(() => {
            assert.notCalled(webex.credentials.getOrgId);
            const requestArgs = webex.request.getCall(0).args[0];

            assert.include(requestArgs.uri, `/identity/scim/${customOrgId}/v1/Users/`);
          });
      });

      it('constructs org-scoped URL with correct orgId and userId', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com'})
          .then(() => {
            const requestArgs = webex.request.getCall(0).args[0];

            assert.equal(
              requestArgs.uri,
              `https://identity.webex.com/identity/scim/${testOrgId}/v1/Users/${testUserId}`
            );
            assert.equal(requestArgs.method, 'PATCH');
          }));

      it('sends add-only userPreferences when no oldSiteUrl', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com'})
          .then(() => {
            const requestArgs = webex.request.getCall(0).args[0];

            assert.deepEqual(requestArgs.body, {
              schemas: [
                'urn:scim:schemas:core:1.0',
                'urn:scim:schemas:extension:cisco:commonidentity:1.0',
              ],
              userPreferences: [{value: '"preferredWebExSite":"new.webex.com"'}],
            });
          }));

      it('sends delete+add userPreferences when oldSiteUrl provided', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com', oldSiteUrl: 'old.webex.com'})
          .then(() => {
            const requestArgs = webex.request.getCall(0).args[0];

            assert.deepEqual(requestArgs.body.userPreferences, [
              {operation: 'delete', value: '"preferredWebExSite":"old.webex.com"'},
              {value: '"preferredWebExSite":"new.webex.com"'},
            ]);
          }));

      it('returns the response body', () => {
        const responseBody = {id: testUserId, preferredWebExSite: 'new.webex.com'};

        userService.request = sinon.stub().returns(Promise.resolve({body: responseBody}));

        return userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com'})
          .then((result) => {
            assert.deepEqual(result, responseBody);
          });
      });

      it('propagates HTTP 403 rejection', () => {
        const error = new Error('Forbidden');

        error.statusCode = 403;
        userService.request = sinon.stub().callsFake(() => Promise.reject(error));

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /Forbidden/
        );
      });

      it('propagates network error rejection', () => {
        userService.request = sinon
          .stub()
          .callsFake(() => Promise.reject(new Error('Network failure')));

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /Network failure/
        );
      });
    });

    describe('#getMeetingSiteList()', () => {
      it('returns empty array when user is null or undefined', () => {
        assert.deepEqual(userService.getMeetingSiteList(null), []);
        assert.deepEqual(userService.getMeetingSiteList(undefined), []);
        assert.deepEqual(userService.getMeetingSiteList({}), []);
      });

      it('merges linked + train sites, filters # sites, and sorts alphabetically', () => {
        const user = {
          linkedTrainSiteNames: ['charlie.webex.com', 'alpha.webex.com'],
          trainSiteNames: ['bravo.webex.com', 'delta#attendee.webex.com', 'echo.webex.com'],
        };

        const result = userService.getMeetingSiteList(user);

        assert.deepEqual(result, [
          'alpha.webex.com',
          'bravo.webex.com',
          'charlie.webex.com',
          'echo.webex.com',
        ]);
      });
    });

    describe('#verify()', () => {
      it('requires an `email` param', () =>
        assert.isRejected(userService.verify(), /`options.email` is required/));
    });
  });
});
