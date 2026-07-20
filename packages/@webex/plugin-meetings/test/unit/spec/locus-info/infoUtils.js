import {assert} from '@webex/test-helper-chai';
import Sinon from 'sinon';
import InfoUtils from '@webex/plugin-meetings/src/locus-info/infoUtils';

describe('plugin-meetings', () => {
  describe('infoUtils', () => {
    const info = {
      displayHints: {
        moderator: ['HINT_1', 'HINT_2'],
        joined: ['HINT_3', 'VOIP_IS_ENABLED'],
        coHost: ['HINT_4'],
        presenter: ['HINT_5'],
        panelist: ['HINT_6'],
        attendee: ['HINT_7'],
      },
    };

    describe('getInfos', () => {
      it('passes roles to parse', () => {
        const parseSpy = Sinon.spy(InfoUtils, 'parse');

        const roles = ['COHOST', 'MODERATOR'];

        InfoUtils.getInfos({}, info, roles);

        assert.calledWith(parseSpy, info, roles);
      });
    });

    describe('parse', () => {
      it('only gives includes display hints when user has the correct role', () => {
        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: [
            'HINT_3',
            'VOIP_IS_ENABLED',
            'HINT_1',
            'HINT_2',
            'LOWER_SOMEONE_ELSES_HAND',
          ],
        });

        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR', 'COHOST']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: [
            'HINT_3',
            'VOIP_IS_ENABLED',
            'HINT_4',
            'LOWER_SOMEONE_ELSES_HAND',
            'HINT_1',
            'HINT_2',
          ],
        });

        assert.deepEqual(InfoUtils.parse(info, ['COHOST']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['HINT_3', 'VOIP_IS_ENABLED', 'HINT_4', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(info, []), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['HINT_3', 'VOIP_IS_ENABLED'],
        });
      });

      it('only includes interstitial display (VOIP_IS_ENABLED) hints when user has not joined the meeting', () => {
        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR'], false), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['VOIP_IS_ENABLED', 'HINT_1', 'HINT_2', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR'], true), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: [
            'HINT_3',
            'VOIP_IS_ENABLED',
            'HINT_1',
            'HINT_2',
            'LOWER_SOMEONE_ELSES_HAND',
          ],
        });
      });

      it('only includes interstitial display (ANONYMOUS_DISPLAY_NAMES_ENABLED) hints when user has not joined the meeting', () => {
        const interstitialInfo = {
          displayHints: {
            moderator: ['HINT_1', 'HINT_2'],
            joined: [
              'HINT_3',
              'ANONYMOUS_DISPLAY_NAMES_ENABLED',
            ],
            coHost: ['HINT_4'],
            presenter: ['HINT_5'],
            panelist: ['HINT_6'],
            attendee: ['HINT_7'],
          },
        };

        assert.deepEqual(InfoUtils.parse(interstitialInfo, ['MODERATOR'], false), {
          policy: {HINT_3: true, ANONYMOUS_DISPLAY_NAMES_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['ANONYMOUS_DISPLAY_NAMES_ENABLED', 'HINT_1', 'HINT_2', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(interstitialInfo, ['MODERATOR'], true), {
          policy: {HINT_3: true, ANONYMOUS_DISPLAY_NAMES_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: [
            'HINT_3',
            'ANONYMOUS_DISPLAY_NAMES_ENABLED',
            'HINT_1',
            'HINT_2',
            'LOWER_SOMEONE_ELSES_HAND',
          ],
        });
      });

      it('includes all interstitial display hints (VOIP_IS_ENABLED and ANONYMOUS_DISPLAY_NAMES_ENABLED) when user has not joined the meeting', () => {
        const interstitialInfo = {
          displayHints: {
            moderator: ['HINT_1', 'HINT_2'],
            joined: [
              'HINT_3',
              'VOIP_IS_ENABLED',
              'ANONYMOUS_DISPLAY_NAMES_ENABLED',
              'HINT_NON_INTERSTITIAL',
            ],
            coHost: ['HINT_4'],
            presenter: ['HINT_5'],
            panelist: ['HINT_6'],
            attendee: ['HINT_7'],
          },
        };

        assert.deepEqual(InfoUtils.parse(interstitialInfo, [], false), {
          policy: {
            HINT_3: true,
            VOIP_IS_ENABLED: true,
            ANONYMOUS_DISPLAY_NAMES_ENABLED: true,
            HINT_NON_INTERSTITIAL: true,
          },
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['VOIP_IS_ENABLED', 'ANONYMOUS_DISPLAY_NAMES_ENABLED'],
        });

        assert.deepEqual(InfoUtils.parse(interstitialInfo, ['MODERATOR'], false), {
          policy: {
            HINT_3: true,
            VOIP_IS_ENABLED: true,
            ANONYMOUS_DISPLAY_NAMES_ENABLED: true,
            HINT_NON_INTERSTITIAL: true,
          },
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: [
            'VOIP_IS_ENABLED',
            'ANONYMOUS_DISPLAY_NAMES_ENABLED',
            'HINT_1',
            'HINT_2',
            'LOWER_SOMEONE_ELSES_HAND',
          ],
        });
      });

      it('merges presenter hints when user has PRESENTER role', () => {
        assert.deepEqual(InfoUtils.parse(info, ['PRESENTER']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['HINT_3', 'VOIP_IS_ENABLED', 'HINT_5'],
        });
      });

      it('merges panelist hints when user has PANELIST role', () => {
        assert.deepEqual(InfoUtils.parse(info, ['PANELIST']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['HINT_3', 'VOIP_IS_ENABLED', 'HINT_6'],
        });
      });

      it('merges attendee hints when user has ATTENDEE role', () => {
        assert.deepEqual(InfoUtils.parse(info, ['ATTENDEE']), {
          policy: {HINT_3: true, VOIP_IS_ENABLED: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {HINT_5: true},
          panelist: {HINT_6: true},
          attendee: {HINT_7: true},
          userDisplayHints: ['HINT_3', 'VOIP_IS_ENABLED', 'HINT_7'],
        });
      });

      it('only adds datachannel url when present', () => {
        assert.deepEqual(InfoUtils.parse({datachannelUrl: 'some url'}, []), {
          coHost: {LOWER_SOMEONE_ELSES_HAND: true},
          moderator: {LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {},
          panelist: {},
          attendee: {},
          datachannelUrl: 'some url',
          policy: {},
          userDisplayHints: [],
        });

        assert.deepEqual(InfoUtils.parse({}, []), {
          coHost: {LOWER_SOMEONE_ELSES_HAND: true},
          moderator: {LOWER_SOMEONE_ELSES_HAND: true},
          presenter: {},
          panelist: {},
          attendee: {},
          policy: {},
          userDisplayHints: [],
        });
      });
    });

    describe('parseDisplayHintsSection', () => {
      it('returns the correct hints', () => {
        assert.deepEqual(InfoUtils.parseDisplayHintSection(info, 'moderator'), {
          HINT_1: true,
          HINT_2: true,
        });

        assert.deepEqual(InfoUtils.parseDisplayHintSection(info, 'joined'), {
          HINT_3: true,
          VOIP_IS_ENABLED: true,
        });

        assert.deepEqual(InfoUtils.parseDisplayHintSection({}, 'joined'), {});

        assert.deepEqual(InfoUtils.parseDisplayHintSection({displayHints: {}}, 'joined'), {});

        assert.deepEqual(
          InfoUtils.parseDisplayHintSection({displayHints: {joined: {}}}, 'joined'),
          {}
        );
      });
    });

    describe('parse display hint tests', () => {
      let parseDisplayHintSectionSpy;

      beforeEach(() => {
        parseDisplayHintSectionSpy = Sinon.spy(InfoUtils, 'parseDisplayHintSection');
      });

      afterEach(() => {
        parseDisplayHintSectionSpy.restore();
      });

      it('parseModerator calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parseModerator(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'moderator');

        assert.deepEqual(result, {
          ...parseDisplayHintSectionSpy.firstCall.returnValue,
          LOWER_SOMEONE_ELSES_HAND: true,
        });
      });

      it('parsePolicy calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parsePolicy(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'joined');

        assert.deepEqual(result, parseDisplayHintSectionSpy.firstCall.returnValue);
      });

      it('parseCoHost calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parseCoHost(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'coHost');

        assert.deepEqual(result, {
          ...parseDisplayHintSectionSpy.firstCall.returnValue,
          LOWER_SOMEONE_ELSES_HAND: true,
        });
      });

      it('parsePresenter calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parsePresenter(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'presenter');

        assert.deepEqual(result, parseDisplayHintSectionSpy.firstCall.returnValue);
      });

      it('parsePanelist calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parsePanelist(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'panelist');

        assert.deepEqual(result, parseDisplayHintSectionSpy.firstCall.returnValue);
      });

      it('parseAttendee calls parseDisplayHintSection correctly and returns the result', () => {
        const result = InfoUtils.parseAttendee(info);

        assert.calledWith(parseDisplayHintSectionSpy, info, 'attendee');

        assert.deepEqual(result, parseDisplayHintSectionSpy.firstCall.returnValue);
      });
    });
  });
});
