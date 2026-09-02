/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Flag from '@webex/internal-plugin-flag';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-flag', () => {
  describe('Flag', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          flag: Flag,
        },
      });
    });

    describe('#flag()', () => {
      it('requires an activity URL', () =>
        assert.isRejected(webex.internal.flag.create({}, {}), /`activity.url` is required/));
    });

    describe('#mapToActivities()', () => {
      let getServiceFromUrlStub;
      let waitForCatalogStub;

      beforeEach(() => {
        getServiceFromUrlStub = sinon.stub();
        waitForCatalogStub = sinon.stub().resolves();
        webex.internal.services = {
          getServiceFromUrl: getServiceFromUrlStub,
          waitForCatalog: waitForCatalogStub,
        };
        // Reset the request stub that MockWebex already created
        webex.request.resetHistory();
      });

      afterEach(() => {
        sinon.restore();
      });

      it('rejects activity URLs with unrecognized hosts (SECURITY)', async () => {
        const maliciousFlags = [
          {
            'flag-item': 'http://attacker.example/pwn/activities/fake-id',
          },
        ];

        // Service catalog does not recognize the attacker host
        getServiceFromUrlStub.returns(undefined);

        const activities = await webex.internal.flag.mapToActivities(maliciousFlags);

        // Should NOT make any request to the attacker host
        assert.notCalled(webex.request);
        // Should return empty array
        assert.deepEqual(activities, []);
      });

      it('rejects activity URLs from non-conversation Webex services', async () => {
        const flags = [
          {
            'flag-item': 'https://idbroker.webex.com/idb/activities/fake-id',
          },
        ];

        getServiceFromUrlStub.returns({name: 'idbroker'});

        const activities = await webex.internal.flag.mapToActivities(flags);

        assert.notCalled(webex.request);
        assert.deepEqual(activities, []);
      });

      it('allows activity URLs from known Webex services', async () => {
        const legitimateFlags = [
          {
            'flag-item': 'https://conv-a.wbx2.com/conversation/api/v1/activities/abc-123',
          },
        ];

        // Service catalog recognizes this host
        getServiceFromUrlStub.returns({
          name: 'conversation',
          priorityUrl: 'https://conv-a.wbx2.com',
        });

        webex.request.resolves({
          body: {
            multistatus: [
              {
                status: '200',
                data: {activity: {id: 'abc-123', verb: 'post'}},
              },
            ],
          },
        });

        const activities = await webex.internal.flag.mapToActivities(legitimateFlags);

        // Should make request to legitimate URL
        assert.calledOnce(webex.request);
        assert.calledWithMatch(webex.request, {
          url: 'https://conv-a.wbx2.com/conversation/api/v1/bulk_activities_fetch',
        });
        assert.lengthOf(activities, 1);
        assert.equal(activities[0].id, 'abc-123');
      });

      it('filters out malicious URLs while processing legitimate ones', async () => {
        const mixedFlags = [
          {
            'flag-item': 'http://evil.com/activities/bad-id',
          },
          {
            'flag-item': 'https://conv-a.wbx2.com/conversation/api/v1/activities/good-id',
          },
        ];

        // Only recognize the legitimate host
        getServiceFromUrlStub.callsFake((url) => {
          if (url.includes('conv-a.wbx2.com')) {
            return {name: 'conversation', priorityUrl: 'https://conv-a.wbx2.com'};
          }

          return undefined;
        });

        webex.request.resolves({
          body: {
            multistatus: [
              {
                status: '200',
                data: {activity: {id: 'good-id', verb: 'post'}},
              },
            ],
          },
        });

        const activities = await webex.internal.flag.mapToActivities(mixedFlags);

        // Should only make request to legitimate URL, not evil.com
        assert.calledOnce(webex.request);
        const requestUrl = webex.request.firstCall.args[0].url;
        assert.notInclude(requestUrl, 'evil.com');
        assert.include(requestUrl, 'conv-a.wbx2.com');
        assert.lengthOf(activities, 1);
      });

      it('handles malformed activity URLs gracefully', async () => {
        const malformedFlags = [
          {
            'flag-item': 'not-a-valid-url',
          },
        ];

        const activities = await webex.internal.flag.mapToActivities(malformedFlags);

        assert.notCalled(webex.request);
        assert.deepEqual(activities, []);
      });
    });

    describe('#unflag()', () => {
      it('requires a Flag Id', () =>
        assert.isRejected(webex.internal.flag.unflag({}, {}), /`flag.url` is required/));
    });

    describe('#archive()', () => {
      it('requires a Flag Id', () =>
        assert.isRejected(webex.internal.flag.archive({}, {}), /`flag.url` is required/));
    });

    describe('#remove()', () => {
      it('requires a Flag Id', () =>
        assert.isRejected(webex.internal.flag.delete({}, {}), /`flag.url` is required/));
    });
  });
});
