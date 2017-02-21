/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import transform from 'sdp-transform';
import {find} from 'lodash';
import handleErrorEvent from '../lib/handle-error-event';

if (process.env.NODE_ENV !== `test`) {
  throw new Error(`Cannot run the plugin-phone test suite without NODE_ENV === "test"`);
}

describe(`plugin-phone`, function() {
  this.timeout(30000);

  describe(`Phone`, () => {
    let mccoy, spock;
    before(`create users and register`, () => testUsers.create({count: 2})
      .then((users) => {
        [mccoy, spock] = users;
        spock.spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        mccoy.spark = new CiscoSpark({
          credentials: {
            authorization: mccoy.token
          }
        });
        return Promise.all([
          spock.spark.phone.register(),
          mccoy.spark.phone.register()
        ]);
      }));

    let ringMccoy;
    beforeEach(() => {
      ringMccoy = sinon.spy();
      mccoy.spark.phone.on(`call:incoming`, ringMccoy);
    });

    after(`unregister spock and mccoy`, () => Promise.all([
      spock && spock.spark.phone.deregister()
        .catch((reason) => console.warn(`could not disconnect spock from mercury`, reason)),
      mccoy && mccoy.spark.phone.deregister()
        .catch((reason) => console.warn(`could not disconnect mccoy from mercury`, reason))
    ]));

    describe(`#createLocalMediaStream()`, () => {
      it(`returns a MediaStreamObject`, () => {
        return spock.spark.phone.createLocalMediaStream()
          .then((stream) => {
            assert.instanceOf(stream, MediaStream);
          });
      });
    });

    describe(`#deregister()`, () => {
      let mercuryDisconnectSpy;
      beforeEach(() => {
        mercuryDisconnectSpy = sinon.spy(spock.spark.mercury, `disconnect`);
      });

      afterEach(() => mercuryDisconnectSpy.restore());

      it(`disconnects from mercury`, () => {
        return spock.spark.phone.deregister()
          .then(() => assert.calledOnce(mercuryDisconnectSpy))
          .then(() => assert.isFalse(spock.spark.mercury.connected, `Mercury is not connected`))
          .then(() => assert.isFalse(spock.spark.phone.connected, `Mercury (proxied through spark.phone) is not connected`))
          .then(() => mercuryDisconnectSpy.restore());
      });

      it(`unregisters from wdm`, () => assert.isFulfilled(spock.spark.phone.deregister()
        .then(() => assert.isUndefined(spock.spark.device.url))
        .then(() => spock.spark.phone.register())));

      it(`is a noop when not registered`, () => assert.isFulfilled(spock.spark.phone.deregister()
        .then(() => spock.spark.phone.deregister())
        .then(() => spock.spark.phone.register())));
    });

    describe(`#dial()`, () => {
      it(`initiates a video only call`, () => {
        const call = spock.spark.phone.dial(mccoy.email, {
          constraints: {
            video: true,
            audio: false
          }
        });

        return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
          .then(() => {
            const sdp = transform.parse(call.pc.localDescription.sdp);
            assert.notOk(find(sdp.media, {type: `audio`}));
            assert.equal(find(sdp.media, {type: `video`}).direction, `sendrecv`);
          }));
      });

      it(`initiates an audio only call`, () => {
        const call = spock.spark.phone.dial(mccoy.email, {
          constraints: {
            video: false,
            audio: true
          }
        });

        return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
          .then(() => {
            const sdp = transform.parse(call.pc.localDescription.sdp);
            assert.notOk(find(sdp.media, {type: `video`}));
            assert.equal(find(sdp.media, {type: `audio`}).direction, `sendrecv`);
          }));
      });

      it(`initiates a receive-only call`, () => {
        const call = spock.spark.phone.dial(mccoy.email, {
          constraints: {
            video: false,
            audio: false
          },
          offerOptions: {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          }
        });

        return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
          .then(() => {
            const sdp = transform.parse(call.pc.localDescription.sdp);
            assert.equal(find(sdp.media, {type: `audio`}).direction, `recvonly`);
            assert.equal(find(sdp.media, {type: `video`}).direction, `recvonly`);
          }));
      });

      it(`calls a user by email address`, () => {
        const call = spock.spark.phone.dial(mccoy.email);
        return handleErrorEvent(call, () => {
          return mccoy.spark.phone.when(`call:incoming`)
            .then(() => assert.calledOnce(ringMccoy));
        });
      });

      it(`calls a user by AppID username`);

      // TODO const call = spock.spark.phone.dial(`tel:...`);
      it(`calls a PSTN phone number`);

      it.skip(`calls a user by hydra room id`, () => spock.spark.request({
        method: `POST`,
        api: `hydra`,
        resource: `messages`,
        body: {
          toPersonEmail: mccoy.email,
          text: `test message`
        }
      })
        .then((res) => {
          const call = spock.spark.phone.dial(res.body.roomId);
          return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`));
        })
        .then(() => assert.calledOnce(ringMccoy)));

      it(`calls a user by room url`);

      it(`calls a user by hydra user id`);

      it(`calls a user by uuid`);

      // TODO const call = spock.spark.phone.dial(`sip:...`);
      it(`calls a user by sip uri`);

      it(`places a call with an existing MediaStreamObject`, () => {
        return spock.spark.phone.createLocalMediaStream()
          .then((localMediaStream) => {
            const call = spock.spark.phone.dial(mccoy.email, {localMediaStream});
            return mccoy.spark.phone.when(`call:incoming`, ([c]) => c.answer())
              .then(() => assert.equal(call.localMediaStream, localMediaStream));
          });
      });
    });

    describe(`#register()`, () => {
      let kirk;
      beforeEach(() => testUsers.create({count: 1})
        .then(([user]) => {
          kirk = user;
          kirk.spark = new CiscoSpark({
            credentials: {
              authorization: kirk.token
            }
          });
        }));

      afterEach(`unregister kirk`, () => kirk && kirk.spark.phone.deregister());

      it(`registers with wdm`, () => {
        return kirk.spark.phone.register()
          .then(() => assert.isDefined(kirk.spark.device.url));
      });

      it(`connects to mercury`, () => {
        assert.isFalse(kirk.spark.mercury.connected, `Mercury is not connected`);
        assert.isFalse(kirk.spark.phone.connected, `Mercury (proxied through spark.phone) is not conneted`);

        return kirk.spark.phone.register()
          .then(() => {
            assert.isTrue(kirk.spark.mercury.connected, `Mercury is connected after calling register`);
            assert.isTrue(kirk.spark.phone.connected, `spark.phone.connected proxies to spark.mercury.connected`);
          });
      });

      let call;
      afterEach(`end current call`, () => Promise.resolve(call && call.hangup()
        .catch((reason) => console.warn(`failed to end call`, reason))
        .then(() => {call = undefined;})));

      // TODO make this preventable
      it(`fetches active calls`, () => {
        call = spock.spark.phone.dial(kirk.email);
        // use change:locus as the trigger for determining when the post to
        // /call completes.
        return handleErrorEvent(call, () => call.when(`change:locus`)
          .then(() => {
            assert.isFalse(kirk.spark.phone.registered);
            kirk.spark.phone.register();
            return kirk.spark.phone.when(`call:incoming`)
              .then(() => assert.isTrue(kirk.spark.phone.registered, `By the time spark.phone can emit call:incoming, spark.phone.registered must be true`));
          }));
      });

      it(`is a noop when already registered`, () => assert.isFulfilled(spock.spark.phone.register()));
    });

    describe(`#defaultFacingMode`, () => {
      it.skip(`defaults to user`, () => {
        assert.equal(spock.spark.phone.defaultFacingMode, `user`);
      });

      describe(`when video constraints are not specified`, () => {
        it(`gets passed as the video constraint`);
      });

      describe(`when video constraints are not specified`, () => {
        it(`does not get passed as the video constraint`);
      });
    });

    describe(`when a call is received`, () => {
      it(`emits a call:incoming event`, () => {
        spock.spark.phone.dial(mccoy.email);
        return mccoy.spark.phone.when(`call:incoming`)
          .then(() => assert.calledOnce(ringMccoy));
      });
    });
  });
});

// TODO needs tests that go from no media only to audio/video

// TODO move to ciscospark/spark-core
// describe(`.init()`, () => {
//   it(`initializes the sdk with an access_token`);
//   it(`initializes the sdk with a refresh_token`);
//   it(`initializes the sdk with an AppID`);
// });
//
// describe(`.version`, () => {
//   it(`provides the current semantic version of the sdk`);
// });
