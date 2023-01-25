import {assert} from '@webex/test-helper-chai';

import MeetingsUtil from '@webex/plugin-meetings/src/meetings/util';

describe('plugin-meetings', () => {
  describe('Meetings utils function', () => {
    describe('#parseDefaultSiteFromMeetingPreferences', () => {
      it('should return the default true site from user preferences', () => {
        const userPreferences = {
          sites: [
            {
              siteUrl: 'site1-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site2-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'go.webex.com',
              default: true,
            },
            {
              siteUrl: 'site3-example.webex.com',
              default: false,
            },
          ],
        };

        assert.equal(
          MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences),
          'go.webex.com'
        );
      });

      it('should work fine if no default true site', () => {
        const userPreferences = {
          sites: [
            {
              siteUrl: 'site1-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site2-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site3-example.webex.com',
              default: false,
            },
          ],
        };

        assert.equal(MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences), '');
      });

      it('should work fine if sites an empty array', () => {
        const userPreferences = {
          sites: [],
        };

        assert.equal(MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences), '');
      });
    });
  });
});
