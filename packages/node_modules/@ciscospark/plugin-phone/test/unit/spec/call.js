/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {Call} from '../..';
import {EventEmitter} from 'events';

describe(`plugin-phone`, function() {
  this.timeout(30000);

  describe(`Call`, () => {
    let call;
    beforeEach(() => {
      sinon.spy(URL, `revokeObjectURL`);
    });

    afterEach(() => {
      call.parent.mercury.removeAllListeners();
      call.parent.off();
      call.off();
      URL.revokeObjectURL.restore();
      URL.revokeObjectURL(call.localMediaStreamUrl);
      URL.revokeObjectURL(call.remoteMediaStreamUrl);
    });

    describe(`#localMediaStreamUrl`, () => {
      describe(`when the localMediaStream gets set`, () => {
        it(`gets created`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new EventEmitter()
            })
          });
          assert.notOk(call.localMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.localMediaStream = stream;
              assert.isDefined(call.localMediaStream);
              assert.equal(call.localMediaStream, stream);
              assert.isDefined(call.localMediaStreamUrl);
            });
        });
      });

      describe(`when the localMediaStream gets changed`, () => {
        it(`gets revoked and replaced`, () => {
          let orig;
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          assert.notOk(call.localMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.localMediaStream = stream;
              assert.isDefined(call.localMediaStreamUrl);
              orig = call.localMediaStreamUrl;
              return navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
                fake: true
              });
            })
            .then((stream) => {
              call.localMediaStream = stream;
              assert.notEqual(call.localMediaStream, orig);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });

      describe(`when the localMediaStream gets removed`, () => {
        it(`gets revoked`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          assert.notOk(call.localMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.localMediaStream = stream;
              assert.isDefined(call.localMediaStreamUrl);
              const orig = call.localMediaStreamUrl;

              call.media.unset(`localMediaStream`);
              assert.notOk(call.localMediaStream);
              assert.notOk(call.localMediaStreamUrl);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });

      describe(`when the call ends`, () => {
        it(`gets revoked`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          let orig;
          assert.notOk(call.localMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.localMediaStream = stream;
              assert.isDefined(call.localMediaStreamUrl);
              orig = call.localMediaStreamUrl;
              return call.hangup();
            })
            .then(() => {
              assert.notOk(call.media.localMediaStream);
              assert.notOk(call.localMediaStream);
              assert.notOk(call.localMediaStreamUrl);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });
    });

    describe(`#remoteMediaStreamUrl`, () => {
      describe(`when the remoteMediaStream gets set`, () => {
        it(`gets created`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new EventEmitter()
            })
          });
          assert.notOk(call.remoteMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.media.remoteMediaStream = stream;
              assert.isDefined(call.remoteMediaStream);
              assert.equal(call.remoteMediaStream, stream);
              assert.isDefined(call.remoteMediaStreamUrl);
            });
        });
      });

      describe(`when the remoteMediaStream gets changed`, () => {
        it(`gets revoked and replaced`, () => {
          let orig;
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          assert.notOk(call.remoteMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.media.remoteMediaStream = stream;
              assert.isDefined(call.remoteMediaStreamUrl);
              orig = call.remoteMediaStreamUrl;
              return navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
                fake: true
              });
            })
            .then((stream) => {
              call.media.remoteMediaStream = stream;
              assert.notEqual(call.remoteMediaStream, orig);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });

      describe(`when the remoteMediaStream gets removed`, () => {
        it(`gets revoked`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          assert.notOk(call.remoteMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.media.remoteMediaStream = stream;
              assert.isDefined(call.remoteMediaStreamUrl);
              const orig = call.remoteMediaStreamUrl;

              call.media.unset(`remoteMediaStream`);
              assert.notOk(call.remoteMediaStream);
              assert.notOk(call.remoteMediaStreamUrl);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });

      describe(`when the call ends`, () => {
        it(`gets revoked`, () => {
          call = new Call({
            parent: new MockSpark({
              mercury: new MockSpark()
            })
          });
          let orig;
          assert.notOk(call.remoteMediaStream);
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
            fake: true
          })
            .then((stream) => {
              call.media.remoteMediaStream = stream;
              assert.isDefined(call.remoteMediaStreamUrl);
              orig = call.remoteMediaStreamUrl;
              return call.hangup();
            })
            .then(() => {
              assert.notOk(call.media.remoteMediaStream);
              assert.notOk(call.remoteMediaStream);
              assert.notOk(call.remoteMediaStreamUrl);
              assert.calledWith(URL.revokeObjectURL, orig);
            });
        });
      });
    });

    describe(`on(localMediaStream:change)`, () => {
      it(`gets triggered when the localMediaStreamUrl is updated`, () => {
        call = new Call({
          parent: new MockSpark({
            mercury: new EventEmitter()
          })
        });
        const spy = sinon.spy();
        call.on(`localMediaStream:change`, spy);
        assert.notOk(call.localMediaStream);
        return navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
          fake: true
        })
          .then((stream) => {
            assert.notCalled(spy);
            call.localMediaStream = stream;
            assert.calledOnce(spy);
          });
      });
    });

    describe(`on(remoteMediaStream:change)`, () => {
      it(`gets triggered when the remoteMediaStreamUrl is updated`, () => {
        call = new Call({
          parent: new MockSpark({
            mercury: new EventEmitter()
          })
        });
        const spy = sinon.spy();
        call.on(`remoteMediaStream:change`, spy);
        assert.notOk(call.remoteMediaStream);
        return navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
          fake: true
        })
          .then((stream) => {
            assert.notCalled(spy);
            call.media.remoteMediaStream = stream;
            assert.calledOnce(spy);
          });
      });
    });
  });
});
