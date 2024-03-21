import ControlsOptionsManager from '@webex/plugin-meetings/src/controls-options-manager';
import Util from '@webex/plugin-meetings/src/controls-options-manager/util';
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

            describe('update()', () => {
              let manager;

              beforeEach(() => {
                request = {
                  request: sinon.stub().resolves(),
                };

                manager = new ControlsOptionsManager(request);

                manager.set({
                  locusUrl: 'test/id',
                  displayHints: [],
                });
              });

              it('should throw an error if the scope is not supported', () => {
                const scope = 'invalid';

                assert.throws(() => manager.update({scope}));
              });

              it('should throw an error if canUpdate returns false', () => {
                const restorable = Util.canUpdate;
                Util.canUpdate = sinon.stub().returns(false);

                const scope = 'audio';

                assert.throws(() => manager.update({scope}));
                Util.canUpdate = restorable;
              });

              it('should call request multiple times with a bodies that include formatted locus details', () => {
                const restorable = Util.canUpdate;
                Util.canUpdate = sinon.stub().returns(true);

                const audio = {scope: 'audio', properties: {a: 1, b: 2}};
                const reactions = {scope: 'reactions', properties: {c: 3, d: 4}};

                return manager.update(audio, reactions)
                  .then(() => {
                    assert.calledWith(request.request, {
                      uri: 'test/id/controls',
                      body: {
                        audio: audio.properties,
                      },
                      method: HTTP_VERBS.PATCH,
                    });

                    assert.calledWith(request.request, {
                      uri: 'test/id/controls',
                      body: {
                        reactions: reactions.properties,
                      },
                      method: HTTP_VERBS.PATCH,
                    });

                    Util.canUpdate = restorable;
                  });
              });

              it('should check if the user can update for each provided control config', () => {
                const restorable = Util.canUpdate;
                Util.canUpdate = sinon.stub().returns(true);

                const audio = {scope: 'audio', properties: {a: 1, b: 2}};
                const reactions = {scope: 'reactions', properties: {c: 3, d: 4}};
                const controls = [audio, reactions];

                return manager.update(...controls)
                  .then(() => {
                    assert.callCount(Util.canUpdate, controls.length);

                    controls.forEach((control) => {
                      assert.calledWith(Util.canUpdate, control, manager.displayHints);
                    });

                    Util.canUpdate = restorable;
                  });
              });
            });

            describe('Mute/Unmute All', () => {
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

              it('rejects when correct display hint is not present mutedEnabled=false', () => {  
                const result = manager.setMuteAll(false, false, false);

                assert.notCalled(request.request);

                assert.isRejected(result);
              });

              it('rejects when correct display hint is not present mutedEnabled=true', () => {  
                const result = manager.setMuteAll(true, false, false);

                assert.notCalled(request.request);

                assert.isRejected(result);
              });

              it('can set mute all when the display hint is available mutedEnabled=true', () => {
                manager.setDisplayHints(['MUTE_ALL', 'ENABLE_HARD_MUTE', 'ENABLE_MUTE_ON_ENTRY']);

                const result = manager.setMuteAll(true, true, true);

                assert.calledWith(request.request, {  uri: 'test/id/controls',
                body: { audio: { muted: true, disallowUnmute: true, muteOnEntry: true } },
                method: HTTP_VERBS.PATCH});

                assert.deepEqual(result, request.request.firstCall.returnValue);
              });

              it('can set mute all when the display hint is available mutedEnabled=true', () => {
                manager.setDisplayHints(['MUTE_ALL', 'DISABLE_HARD_MUTE', 'ENABLE_MUTE_ON_ENTRY']);

                const result = manager.setMuteAll(true, true, true);

                assert.calledWith(request.request, {  uri: 'test/id/controls',
                body: { audio: { muted: true, disallowUnmute: true, muteOnEntry: true } },
                method: HTTP_VERBS.PATCH});

                assert.deepEqual(result, request.request.firstCall.returnValue);
              });

              it('can set mute all when the display hint is available mutedEnabled=true', () => {
                manager.setDisplayHints(['MUTE_ALL', 'DISABLE_HARD_MUTE', 'DISABLE_MUTE_ON_ENTRY']);

                const result = manager.setMuteAll(true, true, true);

                assert.calledWith(request.request, {  uri: 'test/id/controls',
                body: { audio: { muted: true, disallowUnmute: true, muteOnEntry: true } },
                method: HTTP_VERBS.PATCH});

                assert.deepEqual(result, request.request.firstCall.returnValue);
              });

              it('can set mute all when the display hint is available mutedEnabled=false', () => {
                manager.setDisplayHints(['UNMUTE_ALL', 'DISABLE_HARD_MUTE', 'DISABLE_MUTE_ON_ENTRY']);

                const result = manager.setMuteAll(false, false, false);

                assert.calledWith(request.request, {  uri: 'test/id/controls',
                body: { audio: { muted: false, disallowUnmute: false, muteOnEntry: false } },
                method: HTTP_VERBS.PATCH});

                assert.deepEqual(result, request.request.firstCall.returnValue);
              });
            });
          });
    });
});