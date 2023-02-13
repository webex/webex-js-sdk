import ControlsOptionsUtil from '@webex/plugin-meetings/src/controls-options-manager/util';
import { assert } from 'chai';

describe('plugin-meetings', () => {
    describe('controls-option-manager tests', () => {
        describe('util tests', () => {

            let locusInfo;
        
            beforeEach(() => {
              locusInfo = {
                parsedLocus: {
                  info: {
                    userDisplayHints: [],
                  },
                },
              };
            });
        
            describe('canUserSetMuteOnEntry', () => {
              it('can set mute on entry enable', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('ENABLE_MUTE_ON_ENTRY');

                assert.equal(ControlsOptionsUtil.canSetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints), true);
              });

              it('can set mute on entry disable', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('DISABLE_MUTE_ON_ENTRY');

                assert.equal(ControlsOptionsUtil.canUnsetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present for setting mute on entry', () => {
                assert.equal(ControlsOptionsUtil.canSetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints), false);
              });

              it('rejects when correct display hint is not present for unsetting mute on entry', () => {
                assert.equal(ControlsOptionsUtil.canUnsetMuteOnEntry(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

            describe('canSetDisallowUnmute', () => {
              it('can set disallow unmute enable', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('ENABLE_HARD_MUTE');

                assert.equal(ControlsOptionsUtil.canSetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints), true);
              });

              it('can set disallow unmute disable', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('DISABLE_HARD_MUTE');

                assert.equal(ControlsOptionsUtil.canUnsetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present', () => {
                assert.equal(ControlsOptionsUtil.canSetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints), false);
              });

              it('rejects when correct display hint is not present', () => {
                assert.equal(ControlsOptionsUtil.canUnsetDisallowUnmute(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

        });
    });
});