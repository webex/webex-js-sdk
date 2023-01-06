import {assert} from '@webex/test-helper-chai';
import ControlsUtils from '@webex/plugin-meetings/src/locus-info/controlsUtils';

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
  });
});
