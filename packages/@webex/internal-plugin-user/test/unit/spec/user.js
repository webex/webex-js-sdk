/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import UserService from '@webex/internal-plugin-user';
import {buildPreferredSiteBody, buildMeetingSiteList, SCIM_SCHEMAS} from '@webex/internal-plugin-user/src/user';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';

describe('plugin-user', () => {
  describe('buildPreferredSiteBody()', () => {
    it('returns SCIM schemas in the body', () => {
      const body = buildPreferredSiteBody('new.webex.com');

      assert.deepEqual(body.schemas, SCIM_SCHEMAS);
    });

    it('builds add-only body when no oldSiteUrl', () => {
      const body = buildPreferredSiteBody('new.webex.com');

      assert.deepEqual(body.userPreferences, [
        {value: '"preferredWebExSite":"new.webex.com"'},
      ]);
    });

    it('builds delete+add body when oldSiteUrl provided', () => {
      const body = buildPreferredSiteBody('new.webex.com', 'old.webex.com');

      assert.deepEqual(body.userPreferences, [
        {operation: 'delete', value: '"preferredWebExSite":"old.webex.com"'},
        {value: '"preferredWebExSite":"new.webex.com"'},
      ]);
    });

    it('embeds site URLs in the SCIM string format', () => {
      const body = buildPreferredSiteBody('my-site.webex.com');

      assert.equal(body.userPreferences[0].value, '"preferredWebExSite":"my-site.webex.com"');
    });
  });

  describe('buildMeetingSiteList()', () => {
    it('returns empty array for null/undefined/empty user', () => {
      assert.deepEqual(buildMeetingSiteList(null), []);
      assert.deepEqual(buildMeetingSiteList(undefined), []);
      assert.deepEqual(buildMeetingSiteList({}), []);
    });

    it('merges linked + train sites and sorts alphabetically', () => {
      const result = buildMeetingSiteList({
        linkedTrainSiteNames: ['charlie.webex.com', 'alpha.webex.com'],
        trainSiteNames: ['bravo.webex.com'],
      });

      assert.deepEqual(result, ['alpha.webex.com', 'bravo.webex.com', 'charlie.webex.com']);
    });

    it('filters out attendee-only sites containing #', () => {
      const result = buildMeetingSiteList({
        trainSiteNames: ['good.webex.com', 'attendee#only.webex.com', 'also-good.webex.com'],
      });

      assert.deepEqual(result, ['also-good.webex.com', 'good.webex.com']);
    });

    it('handles missing linkedTrainSiteNames gracefully', () => {
      const result = buildMeetingSiteList({trainSiteNames: ['only.webex.com']});

      assert.deepEqual(result, ['only.webex.com']);
    });

    it('handles missing trainSiteNames gracefully', () => {
      const result = buildMeetingSiteList({linkedTrainSiteNames: ['only.webex.com']});

      assert.deepEqual(result, ['only.webex.com']);
    });

    it('deduplicates sites appearing in both arrays', () => {
      const result = buildMeetingSiteList({
        linkedTrainSiteNames: ['shared.webex.com', 'alpha.webex.com'],
        trainSiteNames: ['shared.webex.com', 'bravo.webex.com'],
      });

      assert.deepEqual(result, ['alpha.webex.com', 'bravo.webex.com', 'shared.webex.com']);
    });
  });

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

      it('rejects when getOrgId throws and none provided', () => {
        webex.credentials.getOrgId = sinon.stub().throws(new Error('no org'));

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /no org/
        );
      });

      it('rejects when device.userId is not available', () => {
        webex.internal.device.userId = undefined;

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /device\.userId is not available/
        );
      });

      it('uses provided orgId instead of extracting from credentials', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com', orgId: 'custom-org-9999'})
          .then(() => {
            assert.notCalled(webex.credentials.getOrgId);
            const {uri} = webex.request.getCall(0).args[0];

            assert.include(uri, '/identity/scim/custom-org-9999/v1/Users/');
          }));

      it('constructs org-scoped PATCH request with correct URL', () =>
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

      it('does not manually set the authorization header (relies on auth interceptor)', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com'})
          .then(() => {
            const requestArgs = webex.request.getCall(0).args[0];

            assert.notProperty(requestArgs, 'headers');
          }));

      it('passes buildPreferredSiteBody output as request body', () =>
        userService
          .updatePreferredWebexSite({newSiteUrl: 'new.webex.com', oldSiteUrl: 'old.webex.com'})
          .then(() => {
            const {body} = webex.request.getCall(0).args[0];

            assert.deepEqual(body.schemas, SCIM_SCHEMAS);
            assert.lengthOf(body.userPreferences, 2);
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

      it('propagates request errors', () => {
        const error = new Error('Forbidden');

        error.statusCode = 403;
        userService.request = sinon.stub().callsFake(() => Promise.reject(error));

        return assert.isRejected(
          userService.updatePreferredWebexSite({newSiteUrl: 'new.webex.com'}),
          /Forbidden/
        );
      });
    });

    describe('#getMeetingSiteList()', () => {
      it('delegates to buildMeetingSiteList', () => {
        const user = {
          linkedTrainSiteNames: ['charlie.webex.com'],
          trainSiteNames: ['alpha.webex.com'],
        };

        assert.deepEqual(
          userService.getMeetingSiteList(user),
          ['alpha.webex.com', 'charlie.webex.com']
        );
      });
    });

    describe('#verify()', () => {
      it('requires an `email` param', () =>
        assert.isRejected(userService.verify(), /`options.email` is required/));
    });
  });
});
