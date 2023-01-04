import {assert} from '@webex/test-helper-chai';
import Sinon from 'sinon';

import InfoUtils from '@webex/plugin-meetings/src/locus-info/infoUtils';

describe('plugin-meetings', () => {
  describe('infoUtils', () => {
    const info = {
      displayHints: {
        moderator: ['HINT_1', 'HINT_2'],
        joined: ['HINT_3'],
        coHost: ['HINT_4'],
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
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_3', 'HINT_1', 'HINT_2', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR', 'COHOST']), {
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_3', 'HINT_4', 'LOWER_SOMEONE_ELSES_HAND', 'HINT_1', 'HINT_2'],
        });

        assert.deepEqual(InfoUtils.parse(info, ['COHOST']), {
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_3', 'HINT_4', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(info, []), {
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_3'],
        });
      });

      it('only gives includes display hints when user has joined the meeting role', () => {
        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR'], false), {
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_1', 'HINT_2', 'LOWER_SOMEONE_ELSES_HAND'],
        });

        assert.deepEqual(InfoUtils.parse(info, ['MODERATOR'], true), {
          policy: {HINT_3: true},
          moderator: {HINT_1: true, HINT_2: true, LOWER_SOMEONE_ELSES_HAND: true},
          coHost: {HINT_4: true, LOWER_SOMEONE_ELSES_HAND: true},
          userDisplayHints: ['HINT_3', 'HINT_1', 'HINT_2', 'LOWER_SOMEONE_ELSES_HAND'],
        });
      });
    });

    describe('parseDisplayHintsSection', () => {
      it('returns the correct hints', () => {
        assert.deepEqual(InfoUtils.parseDisplayHintSection(info, 'moderator'), {
          HINT_1: true,
          HINT_2: true,
        });

        assert.deepEqual(InfoUtils.parseDisplayHintSection(info, 'joined'), {HINT_3: true});

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
    });
  });
});
