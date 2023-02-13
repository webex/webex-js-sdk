import ControlsOptionsManager from '@webex/plugin-meetings/src/controls-options-manager';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import { HTTP_VERBS } from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('controls-options-manager tests', () => {
        describe('index', () => {
            let request;

            describe('class tests', () => {
                it('can set and extract new values later on', () => {
                    const manager = new ControlsOptionsManager({});
                    assert.isUndefined(manager.getLocusUrl());
                    manager.set({
                      locusUrl: 'test/id',
                    })
                    assert(manager.getLocusUrl(), 'test/id');
                });
            });

            describe('Mute On Entry', () => {
                let manager;
            
                beforeEach(() => {
                  request = {
                    request: sinon.stub().returns(Promise.resolve()),
                  };

                  manager = new ControlsOptionsManager(request);

                  manager.set({
                    locusUrl: 'test/id',
                    displayHints: [],
                  })
                });

                describe('setMuteOnEntry', () => {
                    it('rejects when correct display hint is not present enabled=false', () => {  
                      const result = manager.setMuteOnEntry(false);
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });

                    it('rejects when correct display hint is not present enabled=true', () => {  
                      const result = manager.setMuteOnEntry(true);
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can set mute on entry when the display hint is available enabled=true', () => {
                      manager.setDisplayHints(['ENABLE_MUTE_ON_ENTRY']);
              
                      const result = manager.setMuteOnEntry(true);
              
                      assert.calledWith(request.request, {  uri: 'test/id/controls',
                      body: { muteOnEntry: { enabled: true } },
                      method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });

                    it('can set mute on entry when the display hint is available enabled=false', () => {
                      manager.setDisplayHints(['DISABLE_MUTE_ON_ENTRY']);
              
                      const result = manager.setMuteOnEntry(false);
              
                      assert.calledWith(request.request, {  uri: 'test/id/controls',
                      body: { muteOnEntry: { enabled: false } },
                      method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });

                  describe('setDisallowUnmute', () => {
                    it('rejects when correct display hint is not present enabled=false', () => {  
                      const result = manager.setDisallowUnmute(false);
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });

                    it('rejects when correct display hint is not present enabled=true', () => {  
                      const result = manager.setDisallowUnmute(true);
              
                      assert.notCalled(request.request);
              
                      assert.isRejected(result);
                    });
      
                    it('can set mute on entry when the display hint is available enabled=true', () => {
                      manager.setDisplayHints(['ENABLE_HARD_MUTE']);
              
                      const result = manager.setDisallowUnmute(true);
              
                      assert.calledWith(request.request, {  uri: 'test/id/controls',
                      body: { disallowUnmute: { enabled: true } },
                      method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });

                    it('can set mute on entry when the display hint is available enabled=false', () => {
                      manager.setDisplayHints(['DISABLE_HARD_MUTE']);
              
                      const result = manager.setDisallowUnmute(false);
              
                      assert.calledWith(request.request, {  uri: 'test/id/controls',
                      body: { disallowUnmute: { enabled: false } },
                      method: HTTP_VERBS.PATCH});
              
                      assert.deepEqual(result, request.request.firstCall.returnValue);
                    });
                  });
            });
          });
    });
});