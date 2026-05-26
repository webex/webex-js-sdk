import 'jsdom-global/register';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import ParameterError from '@webex/plugin-meetings/src/common/errors/parameter';
import MeetingRequest from '@webex/plugin-meetings/src/meetings/request';
import {SitePreferenceSelectOption} from '@webex/plugin-meetings/src/meetings/meetings.types';

const multipartSitePrefixList = ['.my.', '.mydmz.', '.mybts.', '.mydev.', '.myats2.', '.myats.'];

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
    meetingRequest.config.meetings.multipartSitePrefixList = multipartSitePrefixList;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#fetchSitePreferencesMeViaSite', () => {
    const assertRequest = (expectedOptions) => {
      assert.calledOnceWithExactly(request, expectedOptions);
    };

    it('throws a parameter error when no Webex site is available', () => {
      assert.throws(
        () => meetingRequest.fetchSitePreferencesMeViaSite(),
        ParameterError,
        'No siteUrl available. Call register() before fetching site preferences or provide options.siteUrl.'
      );
      assert.notCalled(request);
    });

    it('fetches scheduling preferences by default', async () => {
      const result = await meetingRequest.fetchSitePreferencesMeViaSite({siteUrl: 'go.webex.com'});

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
      await meetingRequest.fetchSitePreferencesMeViaSite({siteUrl: 'go.my.webex.com'});

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go.my',
      });
    });

    it('uses the configured multipart site prefix list to derive the site name', async () => {
      meetingRequest.config.meetings.multipartSitePrefixList = ['.custom.'];

      await meetingRequest.fetchSitePreferencesMeViaSite({siteUrl: 'go.my.webex.com'});

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go',
      });
    });

    it('falls back to the first label when no multipart site prefix list is configured', async () => {
      delete meetingRequest.config.meetings.multipartSitePrefixList;

      await meetingRequest.fetchSitePreferencesMeViaSite({siteUrl: 'go.my.webex.com'});

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go',
      });
    });

    it('supports custom site name overrides', async () => {
      await meetingRequest.fetchSitePreferencesMeViaSite({
        siteUrl: 'go.my.webex.com',
        siteName: 'custom-site',
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=custom-site',
      });
    });

    it('supports enum-backed preference sections', async () => {
      await meetingRequest.fetchSitePreferencesMeViaSite({
        siteUrl: 'go.webex.com',
        selectOptions: [SitePreferenceSelectOption.SCHEDULING],
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference?select=scheduling&siteurl=go',
      });
    });

    it('does not suppress request errors', async () => {
      const error = new Error('site preferences failed');

      request.rejects(error);

      await assert.isRejected(
        meetingRequest.fetchSitePreferencesMeViaSite({siteUrl: 'go.webex.com'}),
        'site preferences failed'
      );
    });
  });
});
