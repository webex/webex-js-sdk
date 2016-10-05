/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-phone`, function() {
  this.timeout(60000);

  describe(`Call`, () => {
    /* eslint max-statements: [0] */
    let mccoy, spock;
    before(() => testUsers.create({count: 2})
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

    after(() => Promise.all([
      spock && spock.spark.phone.deregister()
        .catch((reason) => console.warn(`could not disconnect spock from mercury`, reason)),
      mccoy && mccoy.spark.phone.deregister()
        .catch((reason) => console.warn(`could not disconnect mccoy from mercury`, reason))
    ]));

    describe(`#id`, () => {
      it(`identifies the local party's leg of the call`);
    });

    describe(`#sessionId`, () => {
      // This is the locus sessionId which is not currently available at call
      // start
      it(`identifies the call`);
    });

    describe(`#status`, () => {
      let call;
      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`when the remote party has not yet joined`, () => {
        // Running this test puts spock in a weird state because hangup doesn't
        // quite work
        it.skip(`is "initiated"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return call.hangup();
        });
      });

      describe(`when the remote party has acknowledged the call`, () => {
        it(`is "ringing"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => Promise.all([
              c.acknowledge(),
              call.when(`ringing`)
                .then(() => assert.equal(call.status, `ringing`))
            ]));
        });
      });

      describe(`when the receiving party joins the call`, () => {
        it(`is "connected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
          ]);
        });
      });

      describe(`when the local party has left the call`, () => {
        // TODO do we need states for local and remote decline?
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => {
                assert.equal(call.status, `connected`);
                return call.hangup();
              }),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]);
        });
      });

      describe(`when the remote party has left the call`, () => {
        // TODO do we need states for local and remote decline?
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()
                .then(() => c.hangup())),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`)),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]);
        });
      });

      describe(`when the receiving party has declined the call`, () => {
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.reject()),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]);
        });
      });
    });

    describe(`#to`, () => {
      it(`represents the receiving party`);
    });

    describe(`#from`, () => {
      it(`represents the initiating party`);
    });

    describe(`#direction`, () => {
      // TODO should we use webrtc directions?
      it(`indicates the initiating and receiving members of the call`, () => {
        const call = spock.spark.phone.dial(mccoy.email);
        assert.equal(call.direction, `out`);
        return mccoy.spark.phone.when(`call:incoming`)
          .then(([c]) => {
            assert.equal(call.direction, `out`);
            assert.property(c, `locus`);
            assert.isDefined(c.locus);
            assert.property(c, `direction`);
            assert.isDefined(c.direction);
            assert.equal(c.direction, `in`);
          });
      });
    });

    describe(`#remoteMediaStream`, () => {
      // TODO we may get a stream from the remote party before signalling
      // catches up to tell us we're in the connected state
      describe(`before the call is connected`, () => {
        it(`is null`);
      });

      describe(`after the call is connected`, () => {
        it(`is a media stream`);
      });
    });

    describe(`#remoteMediaStreamUrl`, () => {
      describe(`when the remoteMediaStream gets set`, () => {
        it(`gets created`);
      });

      describe(`when the remoteMediaStream gets changed`, () => {
        it(`gets revoked and replaced`);
      });

      describe(`when the remoteMediaStream gets removed`, () => {
        it(`gets revoked`);
      });

      describe(`when the call ends`, () => {
        it(`gets revoked`);
      });
    });

    describe(`#localMediaStream`, () => {
      describe(`when it is replaced mid-call`, () => {
        it(`triggers a renegotiation`);
      });
    });

    describe(`#localMediaStreamUrl`, () => {
      describe(`when the localMediaStream gets set`, () => {
        it(`gets created`);
      });

      describe(`when the localMediaStream gets changed`, () => {
        it(`gets revoked and replaced`);
      });

      describe(`when the localMediaStream gets removed`, () => {
        it(`gets revoked`);
      });

      describe(`when the call ends`, () => {
        it(`gets revoked`);
      });
    });

    describe(`#sendingAudio`, () => {
      describe(`when the local party is sending Audio`, () => {
        it(`is true`);
      });

      describe(`when the local party is not sending Audio`, () => {
        it(`is false`);
      });
    });

    describe(`#sendingVideo`, () => {
      describe(`when the local party is sending Video`, () => {
        it(`is true`);
      });

      describe(`when the local party is not sending Video`, () => {
        it(`is false`);
      });
    });

    describe(`#receivingAudio`, () => {
      describe(`when the local party is receiving Audio`, () => {
        it(`is true`);
      });

      describe(`when the local party is not receiving Audio`, () => {
        it(`is false`);
      });
    });

    describe(`#receivingVideo`, () => {
      describe(`when the local party is receiving Video`, () => {
        it(`is true`);
      });

      describe(`when the local party is not receiving Video`, () => {
        it(`is false`);
      });
    });

    describe(`#facingMode`, () => {
      describe(`when using the out-facing camera`, () => {
        it(`is "environment"`);
      });

      describe(`when using the user-facing camera`, () => {
        it(`is "user"`);
      });
    });

    describe(`#answer()`, () => {
      it(`accepts an incoming call`);
      it(`reconnects to an in-progress call (e.g. in event of media disconnect due to page reload)`);
      it(`is a noop for outbound calls`);
      it(`is a noop for answered calls`);
    });

    describe(`#hangup()`, () => {
      it(`ends an in-progress call`);
      it(`gets called when the local party is the last member of the call`);
      it(`gets called when the local becomes inactive`);
      describe(`when the local party has not yet answered`, () => {
        it(`proxies to #reject()`);
      });
    });

    describe(`#reject()`, () => {
      it(`declines an incoming call`);
      it(`is a noop for outbound calls`);
      it(`is a noop if answered calls`);
    });

    describe(`#toggleFacingMode`, () => {
      describe(`when the facing mode is "user"`, () => {
        it(`changes the facing mode to "environment"`);
      });

      describe(`when the facing mode is "environment"`, () => {
        it(`changes the facing mode to "user"`);
      });
    });

    describe(`#sendFeedback()`, () => {
      // TODO move to unit test?
      it(`sends feedback to the metrics backend`);
      it(`accepts a "userRating" integer`);
      it(`accepts a "userComments" string`);
      it(`accepts a "includeLogs" boolean`);
    });

    describe(`on(ringing)`, () => {
      it(`gets triggered when the remote party acknowledges the call`);
    });

    describe(`on(connected)`, () => {
      it(`gets triggered when the call is connected`);
    });

    describe(`on(disconnected)`, () => {
      it(`gets triggered when the call is disconnected`);
    });

    // FIXME: this test makes the afterEach timeout because hangup waits
    // for a locus to arrive forever; let's refactor the way error gets emitted
    // so it's a member of the status enum
    describe.skip(`on(error)`, () => {
      it(`gets triggered when something fails in a non-promise-returning method`, () => {
        this.timeout(60000);
        const call = spock.spark.phone.dial(`no one`);

        const errorSpy = sinon.spy();
        call.on(`error`, errorSpy);
        return call.when(`error`)
          .then(() => assert.called(errorSpy));
      });
    });

    describe(`on(localMediaStream:change)`, () => {
      // Note: we want to wait for the url update so we don't try to access the
      // url before it has been replaced
      it(`gets triggered when the localMediaStreamUrl is updated`);
    });

    describe(`on(remoteMediaStream:change)`, () => {
      // Note: we want to wait for the url update so we don't try to access the
      // url before it has been replaced
      it(`gets triggered when the remoteMediaStreamUrl is updated`);
    });

    describe(`in-progress events`, () => {
      describe(`on(remote:audioMuted)`, () => {
        it(`gets triggered when the remote party mutes their audio`);
      });

      describe(`on(remote:audioUnmuted)`, () => {
        it(`gets triggered when the remote party unmutes their audio`);
      });

      describe(`on(remote:videoMuted)`, () => {
        it(`gets triggered when the remote party mutes their video`);
      });

      describe(`on(remote:videoUnmuted)`, () => {
        it(`gets triggered when the remote party unmutes their video`);
      });
    });
  });
});
