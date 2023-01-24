import RecordingController from '@webex/plugin-meetings/src/recording-controller';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import { HTTP_VERBS } from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('recording-controller tests', () => {
        describe('index', () => {
            let request;

            describe('class tests', () => {
                it('can create an instance with the extracted values', () => {
                    const controller = new RecordingController({}, {
                        url: 'test/id',
                        fullState: {
                            sessionId: 'testId',
                        },
                        services: {
                            record: {
                                url: 'test'
                            }
                        }
                    })
                    assert(controller.serviceUrl, 'test');
                    assert(controller.sessionId, 'testId');
                    assert(controller.locusUrl, 'test/id');
                    assert(controller.locusId, 'id');
                });

                it('can set and extract new values later on', () => {
                    const controller = new RecordingController({}, {});
                    assert.isUndefined(controller.serviceUrl);
                    assert.isUndefined(controller.sessionId);
                    assert.isUndefined(controller.locusUrl);
                    assert.isUndefined(controller.locusId);
                    controller.set({
                        url: 'test/id',
                        fullState: {
                            sessionId: 'testId',
                        },
                        services: {
                            record: {
                                url: 'test'
                            }
                        }
                    });
                    assert(controller.serviceUrl, 'test');
                    assert(controller.sessionId, 'testId');
                    assert(controller.locusUrl, 'test/id');
                    assert(controller.locusId, 'id');
                });
            });


            describe('legacy locus style recording', () => {
                let locusInfo;
                const locusUrl = 'locusUrl';
                let controller;
            
                beforeEach(() => {
                  locusInfo = {
                    parsedLocus: {
                      info: {
                        userDisplayHints: ['RECORDING_CONTROL_START'],
                      },
                    },
                    url: locusUrl,
                  };
                  request = {
                    recordMeeting: sinon.stub().returns(Promise.resolve()),
                  };

                  controller = new RecordingController(request, locusInfo);
                });
            
                describe('startRecording', () => {
                  it('rejects when correct display hint is not present', () => {
                    locusInfo.parsedLocus.info.userDisplayHints = [];

                    const result = controller.startRecording();
            
                    assert.notCalled(request.recordMeeting);
            
                    assert.isRejected(result);
                  });
    
                  it('can start recording when the correct display hint is present', () => {
                    locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_START');
            
                    const result = controller.startRecording();
            
                    assert.calledWith(request.recordMeeting, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: false}}, method: HTTP_VERBS.PATCH});
            
                    assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                  });
                });

                describe('stopRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.stopRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can stop recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_STOP');
              
                      const result = controller.stopRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `${locusUrl}/controls`, body: {record: {recording: false, paused: false}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });

                  describe('pauseRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can pause recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_PAUSE');
              
                      const result = controller.pauseRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: true}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });

                  describe('resumeRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can resume recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_RESUME');
              
                      const result = controller.resumeRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: false}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });
            });

            describe('recording streaming service style tests', () => {
                let locusInfo;
                const locusUrl = 'locusUrl';
                let controller;
            
                beforeEach(() => {
                  locusInfo = {
                    fullState: {
                        sessionId: 'testId',
                    },
                    parsedLocus: {
                      info: {
                        userDisplayHints: [],
                      },
                    },
                    url: 'test/id',
                    services: {
                        record: {
                            url: 'test'
                        }
                    }
                  };
                  request = {
                    recordMeeting: sinon.stub().returns(Promise.resolve()),
                  };

                  controller = new RecordingController(request, locusInfo);
                });

                describe('startRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.startRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can start recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_START');
              
                      const result = controller.startRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: locusInfo.fullState.sessionId}, recording: {action: 'start'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });

                  describe('stopRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can start recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_STOP');
              
                      const result = controller.stopRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: locusInfo.fullState.sessionId}, recording: {action: 'stop'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });

                  describe('pauseRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can pause recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_PAUSE');
              
                      const result = controller.pauseRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: locusInfo.fullState.sessionId}, recording: {action: 'pause'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });

                  describe('resumeRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints = [];
  
                      const result = controller.resumeRecording();
              
                      assert.notCalled(request.recordMeeting);
              
                      assert.isRejected(result);
                    });
      
                    it('can resume recording when the correct display hint is present', () => {
                      locusInfo.parsedLocus.info.userDisplayHints.push('RECORDING_CONTROL_RESUME');
              
                      const result = controller.resumeRecording();
              
                      assert.calledWith(request.recordMeeting, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: locusInfo.fullState.sessionId}, recording: {action: 'resume'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.recordMeeting.firstCall.returnValue);
                    });
                  });
            });
          });
    });
});