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
    })
  });
});
