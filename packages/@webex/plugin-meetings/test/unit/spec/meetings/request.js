import 'jsdom-global/register';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import MeetingRequest from '@webex/plugin-meetings/src/meetings/request';

describe('plugin-meetings/meetings/request', () => {
  let meetingRequest;
  let request;

  beforeEach(() => {
    const webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    request = sinon.stub().resolves({
      body: {
        scheduling: {
          supportScheduleWebinar: true,
          webinarWebLink: 'https://go.webex.com/webappng/sites/go/webinar/scheduler',
        },
      },
    });

    meetingRequest = new MeetingRequest(
      {},
      {
        parent: webex,
      }
    );
    meetingRequest.request = request;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#fetchSitePreferencesMeViaSite', () => {
    const assertRequest = (expectedOptions) => {
      assert.calledOnceWithExactly(request, expectedOptions);
    };

    it('fetches scheduling preferences by default', async () => {
      const result = await meetingRequest.fetchSitePreferencesMeViaSite('go.webex.com');

      assert.deepEqual(result, {
        scheduling: {
          supportScheduleWebinar: true,
          webinarWebLink: 'https://go.webex.com/webappng/sites/go/webinar/scheduler',
        },
      });
      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go',
      });
    });

    it('derives the site name for my.webex.com sites', async () => {
      await meetingRequest.fetchSitePreferencesMeViaSite('go.my.webex.com');

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go.my',
      });
    });

    it('supports custom preference sections', async () => {
      await meetingRequest.fetchSitePreferencesMeViaSite('go.webex.com', ['scheduling', 'custom']);

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference?select=scheduling%2Ccustom&siteurl=go',
      });
    });

    it('does not suppress request errors', async () => {
      const error = new Error('site preferences failed');

      request.rejects(error);

      await assert.isRejected(
        meetingRequest.fetchSitePreferencesMeViaSite('go.webex.com'),
        'site preferences failed'
      );
    });
  });
});
