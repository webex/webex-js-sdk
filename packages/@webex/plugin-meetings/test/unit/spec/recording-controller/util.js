import RecordingUtil from '@webex/plugin-meetings/src/recording-controller/util';
import RecordingAction from '@webex/plugin-meetings/src/recording-controller/enums';
import { assert } from 'chai';

describe('plugin-meetings', () => {
    describe('recording-controller tests', () => {
        describe('recording util tests', () => {

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
        
            describe('canUserStart', () => {
              it('can start recording when the correct display hint is present', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_START');

                assert.equal(RecordingUtil.canUserStart(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present', () => {
                assert.equal(RecordingUtil.canUserStart(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

            describe('canUserPause', () => {
              it('can pause recording when the correct display hint is present', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_PAUSE');

                assert.equal(RecordingUtil.canUserPause(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present', () => {
                assert.equal(RecordingUtil.canUserPause(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

            describe('canUserStop', () => {
              it('can stop recording when the correct display hint is present', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_STOP');

                assert.equal(RecordingUtil.canUserStop(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present', () => {
                assert.equal(RecordingUtil.canUserStop(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

            describe('canUserResume', () => {
              it('can start recording when the correct display hint is present', () => {
                locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_RESUME');

                assert.equal(RecordingUtil.canUserResume(locusInfo.parsedLocus.info.userDisplayHints), true);
              });
        
              it('rejects when correct display hint is not present', () => {
                assert.equal(RecordingUtil.canUserResume(locusInfo.parsedLocus.info.userDisplayHints), false);
              });
            });

            describe('deriveRecordingStates', () => {
              it('gets the correct values for a start recording action', () => {
                assert.deepEqual(RecordingUtil.deriveRecordingStates(RecordingAction.Start), {recording: true, paused: false});
              });

              it('gets the correct values for a stop recording action', () => {
                assert.deepEqual(RecordingUtil.deriveRecordingStates(RecordingAction.Stop), {recording: false, paused: false});
              });

              it('gets the correct values for a resume recording action', () => {
                assert.deepEqual(RecordingUtil.deriveRecordingStates(RecordingAction.Resume), {recording: true, paused: false});
              });

              it('gets the correct values for a paused recording action', () => {
                assert.deepEqual(RecordingUtil.deriveRecordingStates(RecordingAction.Pause), {recording: true, paused: true});
              });
            });

            describe('extractLocusId', () => {
              it('gets the correct id from the url param', () => {
                assert.equal(RecordingUtil.extractLocusId('test/id'), 'id');
              });

              it('works with empty string parameters passed', () => {
                assert.equal(RecordingUtil.extractLocusId(''), '');
              });

              it('works with no parameters passed', () => {
                assert.isUndefined(RecordingUtil.extractLocusId(undefined));
              });
            });
        });
    });
});