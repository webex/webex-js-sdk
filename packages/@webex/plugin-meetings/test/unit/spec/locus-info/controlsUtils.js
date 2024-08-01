import {assert} from '@webex/test-helper-chai';
import ControlsUtils from '@webex/plugin-meetings/src/locus-info/controlsUtils';
import controlsUtils from "@webex/plugin-meetings/src/locus-info/controlsUtils";

const defaultControls = {
  entryExitTone: {
    enabled: true,
    mode: 'foo',
  },
};

describe('plugin-meetings', () => {
  describe('controlsUtils', () => {
    describe('parse', () => {
      it('parses entryExitTone', () => {
        const parsedControls = ControlsUtils.parse(defaultControls);

        assert.equal(parsedControls.entryExitTone, 'foo');
      });

      it('parses entryExitTone when disabled', () => {
        const parsedControls = ControlsUtils.parse({
          entryExitTone: {
            enabled: false,
            mode: 'foo',
          },
        });

        assert.equal(parsedControls.entryExitTone, null);
      });

      it('handles no entryExitTone', () => {
        const parsedControls = ControlsUtils.parse({});

        assert.equal(parsedControls.entryExitTone, null);
      });

      it('handles no controls', () => {
        const parsedControls = ControlsUtils.parse();

        assert.equal(parsedControls.entryExitTone, null);
      });

      it('should parse the muteOnEntry control', () => {
        const newControls = {muteOnEntry: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.muteOnEntry.enabled, newControls.muteOnEntry.enabled);
      });

      it('should parse the shareControl control', () => {
        const newControls = {shareControl: {control: 'example-value'}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.shareControl.control, newControls.shareControl.control);
      });

      it('should parse the disallowUnmute control', () => {
        const newControls = {disallowUnmute: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.disallowUnmute.enabled, newControls.disallowUnmute.enabled);
      });

      it('should parse the reactions control', () => {
        const newControls = {reactions: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.reactions.enabled, newControls.reactions.enabled);
      });

      it('should parse the reactionDisplayNames control', () => {
        const newControls = {reactions: {showDisplayNameWithReactions: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.reactions.showDisplayNameWithReactions, newControls.reactions.showDisplayNameWithReactions);
      });

      it('should parse the viewTheParticipantList control', () => {
        const newControls = {viewTheParticipantList: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.viewTheParticipantList.enabled, newControls.viewTheParticipantList.enabled);
      });

      it('should parse the raiseHand control', () => {
        const newControls = {raiseHand: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.raiseHand.enabled, newControls.raiseHand.enabled);
      });

      it('should parse the video control', () => {
        const newControls = {video: {enabled: true}};

        const parsedControls = ControlsUtils.parse(newControls);

        assert.equal(parsedControls.video.enabled, newControls.video.enabled);
      });

      describe('videoEnabled', () => {
        it('returns expected', () => {
          const result = ControlsUtils.parse({video: {enabled: true}});
          assert.deepEqual(result, {
            video: {
              enabled: true,
            },
            videoEnabled: true,
          });
        });

        it('returns expected from undefined', () => {
          const result = ControlsUtils.parse();
          assert.deepEqual(result, {});
        });

        it('returns expected from undefined controls', () => {
          const result = ControlsUtils.parse({});
          assert.deepEqual(result, {});
        });
      });
    });

    describe('getControls', () => {
      it('returns hasMuteOnEntryChanged = true when changed', () => {
        const newControls = {muteOnEntry: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasMuteOnEntryChanged, true);
      });

      it('returns hasShareControlChanged = true when changed', () => {
        const newControls = {shareControl: {control: 'example-value'}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasShareControlChanged, true);
      });

      it('returns hasDisallowUnmuteChanged = true when changed', () => {
        const newControls = {disallowUnmute: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasDisallowUnmuteChanged, true);
      });

      it('returns hasReactionsChanged = true when changed', () => {
        const newControls = {reactions: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasReactionsChanged, true);
      });

      it('returns hasReactionDisplayNamesChanged = true when changed', () => {
        const newControls = {reactions: {showDisplayNameWithReactions: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasReactionDisplayNamesChanged, true);
      });

      it('returns hasViewTheParticipantListChanged = true when changed', () => {
        const newControls = {viewTheParticipantList: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasViewTheParticipantListChanged, true);
      });

      it('returns hasRaiseHandChanged = true when changed', () => {
        const newControls = {raiseHand: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasRaiseHandChanged, true);
      });

      it('returns hasVideoChanged = true when changed', () => {
        const newControls = {video: {enabled: true}};

        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasVideoChanged, true);
      });

      it('returns hasEntryExitToneChanged = true when mode changed', () => {
        const newControls = {
          entryExitTone: {
            enabled: true,
            mode: 'bar',
          },
        };
        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasEntryExitToneChanged, true);
      });

      it('returns hasEntryExitToneChanged = true when enabled changed', () => {
        const newControls = {
          entryExitTone: {
            enabled: false,
            mode: 'foo',
          },
        };
        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasEntryExitToneChanged, true);
      });

      it('returns hasEntryExitToneChanged = false when nothing changed', () => {
        const newControls = {
          entryExitTone: {
            enabled: true,
            mode: 'foo',
          },
        };
        const {updates} = ControlsUtils.getControls(defaultControls, newControls);

        assert.equal(updates.hasEntryExitToneChanged, false);
      });

      it('returns hasBreakoutChanged = true when it has changed', () => {
        const newControls = {
          breakout: 'breakout',
        };

        const {updates} = ControlsUtils.getControls({breakout: 'old breakout'}, newControls);

        assert.equal(updates.hasBreakoutChanged, true);
      });

      it('returns hasBreakoutChanged = false when it has not changed', () => {
        const newControls = {
          breakout: 'breakout',
        };

        const {updates} = ControlsUtils.getControls({breakout: 'breakout'}, newControls);

        assert.equal(updates.hasBreakoutChanged, false);
      });

      it('returns hasInterpretationChanged = true when it has changed', () => {
        const newControls = {
          interpretation: 'interpretation',
        };

        const {updates} = ControlsUtils.getControls({interpretation: 'old one'}, newControls);

        assert.equal(updates.hasInterpretationChanged, true);
      });

      it('returns hasInterpretationChanged = false when it has not changed', () => {
        const newControls = {
          interpretation: 'interpretation',
        };

        const {updates} = ControlsUtils.getControls({interpretation: 'interpretation'}, newControls);

        assert.equal(updates.hasInterpretationChanged, false);
      });

      it('returns hasManualCaptionChanged = true when it has changed', () => {
        const newControls = {
          manualCaptionControl: {enabled: false},
        };

        const {updates} = ControlsUtils.getControls({manualCaptionControl: {enabled: true}}, newControls);

        assert.equal(updates.hasManualCaptionChanged, true);
      });

      it('returns hasManualCaptionChanged = false when it has not changed', () => {
        const newControls = {
          manualCaptionControl: {enabled: true},
        };

        const {updates} = ControlsUtils.getControls({manualCaptionControl: {enabled: true}}, newControls);

        assert.equal(updates.hasManualCaptionChanged, false);
      });

      describe('videoEnabled', () => {
        const testVideoEnabled = (oldControls, newControls, updatedProperty) => {
          const result = ControlsUtils.getControls(oldControls, newControls);

          let expectedPrevious = oldControls;
          if (Object.keys(oldControls).length) {
            expectedPrevious = {
              ...expectedPrevious,
              ...{videoEnabled: oldControls.video.enabled},
            };
          }
          const expectedCurrent = {...newControls, ...{videoEnabled: newControls.video.enabled}};

          assert.deepEqual(result.previous, expectedPrevious);
          assert.deepEqual(result.current, expectedCurrent);
          if (updatedProperty !== undefined) {
            assert.deepEqual(
              result.updates.hasVideoEnabledChanged,
              !isEqual(oldControls, newControls)
            );
          }
        };

        it('returns expected from undefined', () => {
          testVideoEnabled({}, {video: {enabled: true}});
        });

        it('returns expected from defined', () => {
          testVideoEnabled({video: {enabled: false}}, {video: {enabled: true}});
        });

        it('returns expected for unchanged', () => {
          testVideoEnabled({video: {enabled: false}}, {video: {enabled: false}});
        });
      });
    });

    describe('isNeedReplaceMembers', () => {
      it('if no breakout control, return false', () => {
        const oldControls = {};
        const newControls = {};
        assert.equal(controlsUtils.isNeedReplaceMembers(oldControls, newControls), false);
      });

      it('if current session moved, return true', () => {
        const oldControls = {breakout: {sessionId: 'sessionId1', groupId: 'groupId1'}};
        const newControls = {breakout: {sessionId: 'sessionId2', groupId: 'groupId2'}};
        assert.equal(controlsUtils.isNeedReplaceMembers(oldControls, newControls), true);
      });

      it('if in same session, return false', () => {
        const oldControls = {breakout: {sessionId: 'sessionId1', groupId: 'groupId'}};
        const newControls = {breakout: {sessionId: 'sessionId1', groupId: 'groupId'}};
        assert.equal(controlsUtils.isNeedReplaceMembers(oldControls, newControls), false);
      });
    });

    describe('getSessionSwitchStatus', () => {
      it('if no breakout control, return switch status both false', () => {
        const oldControls = {};
        const newControls = {};
        assert.deepEqual(controlsUtils.getSessionSwitchStatus(oldControls, newControls), {
          isReturnToMain: false, isJoinToBreakout: false
        });
      });

      it('if switch session from breakout to main, return isReturnToMain as true', () => {
        const oldControls = {breakout: {sessionType: 'BREAKOUT'}};
        const newControls = {breakout: {sessionType: 'MAIN'}};
        assert.deepEqual(controlsUtils.getSessionSwitchStatus(oldControls, newControls), {
          isReturnToMain: true, isJoinToBreakout: false
        });
      });

      it('if switch session from main to breakout, return isJoinToBreakout as true', () => {
        const oldControls = {breakout: {sessionType: 'MAIN'}};
        const newControls = {breakout: {sessionType: 'BREAKOUT'}};
        assert.deepEqual(controlsUtils.getSessionSwitchStatus(oldControls, newControls), {
          isReturnToMain: false, isJoinToBreakout: true
        });
      });
    });

    describe('#isMainSessionDTO', () => {
      it('return false is sessionType is BREAKOUT', () => {
        const locus = {
          controls: {breakout: {sessionType: 'BREAKOUT'}}
        };

        assert.equal(controlsUtils.isMainSessionDTO(locus), false);
      });

      it('return true is sessionType is not BREAKOUT', () => {
        const locus = {
          controls: {breakout: {sessionType: 'MAIN'}}
        };

        assert.equal(controlsUtils.isMainSessionDTO(locus), true);

        assert.equal(controlsUtils.isMainSessionDTO({}), true);
      });
    });
  });
});
