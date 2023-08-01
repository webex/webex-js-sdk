import {DISPLAY_HINTS} from '@webex/plugin-meetings/src/constants';
import ControlsOptionsUtil from '@webex/plugin-meetings/src/controls-options-manager/util';
import {assert} from 'chai';
import sinon from 'sinon';

describe('plugin-meetings', () => {
  describe('controls-option-manager tests', () => {
    describe('util tests', () => {
      let locusInfo;

      beforeEach(() => {
        sinon.restore();

        locusInfo = {
          parsedLocus: {
            info: {
              userDisplayHints: [],
            },
          },
        };
      });

      describe('hasHints()', () => {
        it('should return true if all hints are found', () => {
          const hints = ['EXAMPLE_HINT_A', 'EXAMPLE_HINT_B'];

          locusInfo.parsedLocus.info.userDisplayHints.push(...hints);

          assert.isTrue(ControlsOptionsUtil.hasHints({requiredHints: hints, displayHints: hints}));
        });

        it('should return false if all hints are not found', () => {
          const hints = ['EXAMPLE_HINT_A', 'EXAMPLE_HINT_B'];

          locusInfo.parsedLocus.info.userDisplayHints.push(...hints);

          assert.isFalse(ControlsOptionsUtil.hasHints({requiredHints: hints, displayHints: []}));
        });
      });

      describe('hasPolicies()', () => {
        it('should return true if all policies are found', () => {
          assert.isTrue(
            ControlsOptionsUtil.hasPolicies({
              requiredPolicies: ['EXAMPLE_POLICY_A', 'EXAMPLE_POLICY_B'],
              policies: {EXAMPLE_POLICY_A: true, EXAMPLE_POLICY_B: true, EXAMPLE_POLICY_C: true},
            })
          );
        });

        it('should return false if all policies are not found', () => {
          assert.isFalse(
            ControlsOptionsUtil.hasPolicies({
              requiredPolicies: ['EXAMPLE_POLICY_A', 'EXAMPLE_POLICY_C'],
              policies: {EXAMPLE_POLICY_A: true, EXAMPLE_POLICY_B: true},
            })
          );
        });
      });

      describe('canUpdateAudio()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints when `muted` is true', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {muted: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.MUTE_ALL],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `muted` is false', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {muted: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.UNMUTE_ALL],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `disallowUnmute` is true', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {disallowUnmute: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_HARD_MUTE],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `disallowUnmute` is false', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {disallowUnmute: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_HARD_MUTE],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `muteOnEntry` is true', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {muteOnEntry: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `muteOnEntry` is false', () => {
          ControlsOptionsUtil.canUpdateAudio({properties: {muteOnEntry: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY],
            displayHints: [],
          });
        });

        it('should call hasHints() with all properties after negotiating hints', () => {
          const properties = {
            muted: true,
            disallowUnmute: true,
            muteOnEntry: true,
          };

          ControlsOptionsUtil.canUpdateAudio({properties}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [
              DISPLAY_HINTS.MUTE_ALL,
              DISPLAY_HINTS.ENABLE_HARD_MUTE,
              DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY,
            ],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateAudio({properties: {}}, []);

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdateRaiseHand()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints when `enabled` is true', () => {
          ControlsOptionsUtil.canUpdateRaiseHand({properties: {enabled: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_RAISE_HAND],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `enabled` is false', () => {
          ControlsOptionsUtil.canUpdateRaiseHand({properties: {enabled: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_RAISE_HAND],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateRaiseHand({properties: {}}, []);

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdateReactions()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints when `enabled` is true', () => {
          ControlsOptionsUtil.canUpdateReactions({properties: {enabled: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_REACTIONS],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `enabled` is false', () => {
          ControlsOptionsUtil.canUpdateReactions({properties: {enabled: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_REACTIONS],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `showDisplayNameWithReactions` is true', () => {
          ControlsOptionsUtil.canUpdateReactions(
            {properties: {showDisplayNameWithReactions: true}},
            []
          );

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `showDisplayNameWithReactions` is false', () => {
          ControlsOptionsUtil.canUpdateReactions(
            {properties: {showDisplayNameWithReactions: false}},
            []
          );

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_SHOW_DISPLAY_NAME],
            displayHints: [],
          });
        });

        it('should call hasHints() with only enabled hints when respective property is provided', () => {
          const properties = {
            enabled: true,
          };

          ControlsOptionsUtil.canUpdateReactions({properties}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_REACTIONS],
            displayHints: [],
          });
        });

        it('should call hasHints() with only display name hints when respective property is provided', () => {
          const properties = {
            enabled: true,
            showDisplayNameWithReactions: true,
          };

          ControlsOptionsUtil.canUpdateReactions({properties}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateReactions({properties: {}}, []);

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdateShareControl()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints', () => {
          ControlsOptionsUtil.canUpdateShareControl([]);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CONTROL],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateShareControl([]);

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdateVideo()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints when `enabled` is true', () => {
          ControlsOptionsUtil.canUpdateVideo({properties: {enabled: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_VIDEO],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `enabled` is false', () => {
          ControlsOptionsUtil.canUpdateVideo({properties: {enabled: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_VIDEO],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateVideo({properties: {}}, []);

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdateViewTheParticipantsList()', () => {
        beforeEach(() => {
          sinon.stub(ControlsOptionsUtil, 'hasHints').returns(true);
        });

        it('should call hasHints() with proper hints when `enabled` is true', () => {
          ControlsOptionsUtil.canUpdateViewTheParticipantsList({properties: {enabled: true}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: [],
          });
        });

        it('should call hasHints() with proper hints when `enabled` is false', () => {
          ControlsOptionsUtil.canUpdateViewTheParticipantsList({properties: {enabled: false}}, []);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: [],
          });
        });

        it('should return the resolution of hasHints()', () => {
          const expected = 'example-return-value';
          ControlsOptionsUtil.hasHints.returns(expected);

          const results = ControlsOptionsUtil.canUpdateViewTheParticipantsList(
            {properties: {}},
            []
          );

          assert.calledOnce(ControlsOptionsUtil.hasHints);
          assert.equal(results, expected);
        });
      });

      describe('canUpdate()', () => {
        const displayHints = [];

        beforeEach(() => {
          ControlsOptionsUtil.canUpdateAudio = sinon.stub().returns(true);
          ControlsOptionsUtil.canUpdateRaiseHand = sinon.stub().returns(true);
          ControlsOptionsUtil.canUpdateReactions = sinon.stub().returns(true);
          ControlsOptionsUtil.canUpdateShareControl = sinon.stub().returns(true);
          ControlsOptionsUtil.canUpdateVideo = sinon.stub().returns(true);
          ControlsOptionsUtil.canUpdateViewTheParticipantsList = sinon.stub().returns(true);
        });

        it('should only call canUpdateAudio() if the scope is audio', () => {
          const control = {scope: 'audio'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.calledWith(ControlsOptionsUtil.canUpdateAudio, control, displayHints);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isTrue(results);
        });

        it('should only call canUpdateRaiseHand() if the scope is raiseHand', () => {
          const control = {scope: 'raiseHand'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.calledWith(ControlsOptionsUtil.canUpdateRaiseHand, control, displayHints);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isTrue(results);
        });

        it('should only call canUpdateReactions() if the scope is reactions', () => {
          const control = {scope: 'reactions'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.calledWith(ControlsOptionsUtil.canUpdateReactions, control, displayHints);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isTrue(results);
        });

        it('should only call canUpdateShareControl() if the scope is shareControl', () => {
          const control = {scope: 'shareControl'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.calledWith(ControlsOptionsUtil.canUpdateShareControl, displayHints);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isTrue(results);
        });

        it('should only call canUpdateVideo() if the scope is video', () => {
          const control = {scope: 'video'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.calledWith(ControlsOptionsUtil.canUpdateVideo, control, displayHints);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isTrue(results);
        });

        it('should only call canUpdateViewTheParticipantsList() if the scope is viewTheParticipantList', () => {
          const control = {scope: 'viewTheParticipantList'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.calledWith(
            ControlsOptionsUtil.canUpdateViewTheParticipantsList,
            control,
            displayHints
          );
          assert.isTrue(results);
        });

        it('should return false when the provided control scope is not supported', () => {
          const control = {scope: 'invalid'};

          const results = ControlsOptionsUtil.canUpdate(control, displayHints);

          assert.callCount(ControlsOptionsUtil.canUpdateAudio, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateRaiseHand, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateReactions, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateShareControl, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateVideo, 0);
          assert.callCount(ControlsOptionsUtil.canUpdateViewTheParticipantsList, 0);
          assert.isFalse(results);
        });
      });

      describe('canUserSetMuteOnEntry', () => {
        it('can set mute on entry enable', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('ENABLE_MUTE_ON_ENTRY');

          assert.equal(
            ControlsOptionsUtil.canSetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });

        it('can set mute on entry disable', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('DISABLE_MUTE_ON_ENTRY');

          assert.equal(
            ControlsOptionsUtil.canUnsetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });

        it('rejects when correct display hint is not present for setting mute on entry', () => {
          assert.equal(
            ControlsOptionsUtil.canSetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });

        it('rejects when correct display hint is not present for unsetting mute on entry', () => {
          assert.equal(
            ControlsOptionsUtil.canUnsetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });
      });

      describe('canSetDisallowUnmute', () => {
        it('can set disallow unmute enable', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('ENABLE_HARD_MUTE');

          assert.equal(
            ControlsOptionsUtil.canSetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });

        it('can set disallow unmute disable', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('DISABLE_HARD_MUTE');

          assert.equal(
            ControlsOptionsUtil.canUnsetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });

        it('rejects when correct display hint is not present', () => {
          assert.equal(
            ControlsOptionsUtil.canSetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });

        it('rejects when correct display hint is not present', () => {
          assert.equal(
            ControlsOptionsUtil.canUnsetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });
      });

      describe('canSetMuteAll', () => {
        it('can mute all', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('MUTE_ALL');

          assert.equal(
            ControlsOptionsUtil.canSetMuted(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });

        it('can unmute all', () => {
          locusInfo.parsedLocus.info.userDisplayHints.push('UNMUTE_ALL');

          assert.equal(
            ControlsOptionsUtil.canUnsetMuted(locusInfo.parsedLocus.info.userDisplayHints),
            true
          );
        });
        it('rejects when correct display hint is not present', () => {
          assert.equal(
            ControlsOptionsUtil.canSetMuted(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });

        it('rejects when correct display hint is not present', () => {
          assert.equal(
            ControlsOptionsUtil.canUnsetMuted(locusInfo.parsedLocus.info.userDisplayHints),
            false
          );
        });
      });
    });
  });
});
