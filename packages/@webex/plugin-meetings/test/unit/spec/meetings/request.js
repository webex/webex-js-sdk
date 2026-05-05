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

  describe('#getSitePreferences', () => {
    const assertRequest = (expectedOptions) => {
      assert.calledOnceWithExactly(request, expectedOptions);
    };

    it('uses default preference sections and derived site name', async () => {
      const result = await meetingRequest.getSitePreferences({siteUrl: 'go.webex.com'});

      assert.deepEqual(result, {
        scheduling: {
          supportScheduleWebinar: true,
          webinarWebLink: 'https://go.webex.com/webappng/sites/go/webinar/scheduler',
        },
      });
      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'pmr,audioVideo,scheduling',
          siteurl: 'go',
        },
      });
    });

    it('derives the site name for my.webex.com sites', async () => {
      await meetingRequest.getSitePreferences({siteUrl: 'go.my.webex.com'});

      assertRequest({
        method: 'GET',
        uri: 'https://go.my.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'pmr,audioVideo,scheduling',
          siteurl: 'go.my',
        },
      });
    });

    it('supports custom preference section arrays', async () => {
      await meetingRequest.getSitePreferences({
        siteUrl: 'go.webex.com',
        select: ['scheduling', 'pmr'],
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'scheduling,pmr',
          siteurl: 'go',
        },
      });
    });

    it('supports custom preference section strings', async () => {
      await meetingRequest.getSitePreferences({
        siteUrl: 'go.webex.com',
        select: 'scheduling',
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'scheduling',
          siteurl: 'go',
        },
      });
    });

    it('supports custom site name overrides', async () => {
      await meetingRequest.getSitePreferences({
        siteUrl: 'go.webex.com',
        siteName: 'custom-site',
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'pmr,audioVideo,scheduling',
          siteurl: 'custom-site',
        },
      });
    });

    it('normalizes site URLs with protocols and paths', async () => {
      await meetingRequest.getSitePreferences({
        siteUrl: 'https://go.webex.com/webappng/sites/go/meeting/scheduler',
      });

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'pmr,audioVideo,scheduling',
          siteurl: 'go',
        },
      });
    });

    it('normalizes protocol-relative site URLs', async () => {
      await meetingRequest.getSitePreferences({siteUrl: '//go.webex.com'});

      assertRequest({
        method: 'GET',
        uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
        qs: {
          select: 'pmr,audioVideo,scheduling',
          siteurl: 'go',
        },
      });
    });

    [
      {
        description: 'empty preference section arrays',
        select: [],
      },
      {
        description: 'empty preference section strings',
        select: '',
      },
      {
        description: 'null preference sections',
        select: null,
      },
    ].forEach(({description, select}) => {
      it(`uses default preference sections for ${description}`, async () => {
        await meetingRequest.getSitePreferences({
          siteUrl: 'go.webex.com',
          select,
        });

        assertRequest({
          method: 'GET',
          uri: 'https://go.webex.com/wbxappapi/v1/users/me/preference',
          qs: {
            select: 'pmr,audioVideo,scheduling',
            siteurl: 'go',
          },
        });
      });
    });

    it('rejects when site URL normalization does not produce a host', async () => {
      await assert.isRejected(
        meetingRequest.getSitePreferences({siteUrl: '   '}),
        'No site URL available. Call register() first or provide options.siteUrl.'
      );
      assert.notCalled(request);
    });

    it('does not suppress request errors', async () => {
      const error = new Error('site preferences failed');

      request.rejects(error);

      await assert.isRejected(
        meetingRequest.getSitePreferences({siteUrl: 'go.webex.com'}),
        'site preferences failed'
      );
    });
  });
});
