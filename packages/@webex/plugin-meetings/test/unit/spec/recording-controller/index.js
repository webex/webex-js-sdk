import RecordingController from '@webex/plugin-meetings/src/recording-controller';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import { HTTP_VERBS } from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('recording-controller tests', () => {
        describe('index', () => {
            let request;

            describe('class tests', () => {
                it('can set and extract new values later on', () => {
                    const controller = new RecordingController({});
                    assert.isUndefined(controller.getServiceUrl());
                    assert.isUndefined(controller.getSessionId());
                    assert.isUndefined(controller.getLocusUrl());
                    assert.isUndefined(controller.getLocusId());
                    controller.set({
                      serviceUrl: 'test',
                      sessionId: 'testId',
                      locusUrl: 'test/id',
                      displayHints: [],
                    })
                    assert(controller.getServiceUrl(), 'test');
                    assert(controller.getSessionId(), 'testId');
                    assert(controller.getLocusUrl(), 'test/id');
                    assert(controller.getLocusId(), 'id');
                });
            });


            describe('legacy locus style recording', () => {
                const locusUrl = 'locusUrl';
                let controller;
            
                beforeEach(() => {
                  request = {
                    request: sinon.stub().returns(Promise.resolve()),
                  };

                  controller = new RecordingController(request);

                  controller.set({
                    locusUrl,
                    displayHints: [],
                  })
                  
                });
            
                describe('startRecording', () => {
                  it('rejects when correct display hint is not present', () => {
                    const result = controller.startRecording();
            
                    assert.notCalled(request.request);
            
                    assert.isRejected(result);
                  });
    
                  it('can start recording when the correct display hint is present', () => {
                    controller.setDisplayHints(['RECORDING_CONTROL_START']);
            
                    const result = controller.startRecording();
            
                    assert.calledWith(request.request, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: false}}, method: HTTP_VERBS.PATCH});
            
                    assert.deepEqual(result, request.request.firstCall.returnValue);
                  });
                });

                describe('stopRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      const result = controller.stopRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can stop recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_STOP']);
              
                      const result = controller.stopRecording();
              
                      assert.calledWith(request.request, {uri: `${locusUrl}/controls`, body: {record: {recording: false, paused: false}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('pauseRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can pause recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_PAUSE']);

                      const result = controller.pauseRecording();
              
                      assert.calledWith(request.request, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: true}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('resumeRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can resume recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_RESUME']);
              
                      const result = controller.resumeRecording();
              
                      assert.calledWith(request.request, {uri: `${locusUrl}/controls`, body: {record: {recording: true, paused: false}}, method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });
            });

            describe('recording streaming service style tests', () => {
                let controller;
            
                beforeEach(() => {
                  request = {
                    request: sinon.stub().returns(Promise.resolve()),
                  };

                  controller = new RecordingController(request);

                  controller.set({
                    serviceUrl: 'test',
                    sessionId: 'testId',
                    locusUrl: 'test/id',
                    displayHints: [],
                  })
                });

                describe('startRecording', () => {
                    it('rejects when correct display hint is not present', () => {  
                      const result = controller.startRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can start recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_START']);
              
                      const result = controller.startRecording();
              
                      assert.calledWith(request.request, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: 'testId'}, recording: {action: 'start'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('stopRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can start recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_STOP']);
              
                      const result = controller.stopRecording();
              
                      assert.calledWith(request.request, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: 'testId'}, recording: {action: 'stop'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('pauseRecording', () => {
                    it('rejects when correct display hint is not present', () => {  
                      const result = controller.pauseRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can pause recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_PAUSE']);
              
                      const result = controller.pauseRecording();
              
                      assert.calledWith(request.request, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: 'testId'}, recording: {action: 'pause'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('resumeRecording', () => {
                    it('rejects when correct display hint is not present', () => {
                      const result = controller.resumeRecording();
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can resume recording when the correct display hint is present', () => {
                      controller.setDisplayHints(['RECORDING_CONTROL_RESUME']);
              
                      const result = controller.resumeRecording();
              
                      assert.calledWith(request.request, {uri: `test/loci/id/recording`, body: {meetingInfo: {locusSessionId: 'testId'}, recording: {action: 'resume'}}, method: HTTP_VERBS.PUT});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });
            });
          });
    });
});