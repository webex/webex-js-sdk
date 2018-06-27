/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-phone';

import browser from 'bowser';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import {browserOnly, firefoxOnly, handleErrorEvent} from '@ciscospark/test-helper-mocha';
import WebRTCMediaEngine from '@ciscospark/media-engine-webrtc';
import {parse} from 'sdp-transform';

import {
  expectCallIncomingEvent,
  expectChangeLocusEvent,
  expectMembershipConnectedEvent
} from '../lib/event-expectations';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Cannot run the plugin-phone test suite without NODE_ENV === "test"');
}

function findMembership(call, user) {
  return call.memberships.find((m) => m.personUuid === user.id);
}

function setup(users, assign) {
  assert.property(users, 'spock', 'This test helper requires that you always have a user named "spock"');
  before('create users and register', () => testUsers.create({count: Object.keys(users).length})
    .then((created) => Promise.all(Object.keys(users).map((name, index) => {
      // eslint-disable-next-line no-param-reassign
      users[name] = created[index];
      const user = users[name];
      user.spark = new CiscoSpark({
        credentials: {
          authorization: user.token
        }
      });

      return user.spark.phone.register();
    }))));

  beforeEach('enable group calling', () => Object.values(users).forEach((user) => {
    if (user) {
      // eslint-disable-next-line no-param-reassign
      user.spark.config.phone.enableExperimentalGroupCallingSupport = true;
    }
  }));

  beforeEach(() => users.spock.spark.request({
    method: 'POST',
    service: 'hydra',
    resource: 'rooms',
    body: {
      title: 'Call Test'
    }
  })
    .then((res) => {
      const room = res.body;
      return Promise.resolve(assign(room))
        .then(() => room);
    })
    .then((room) => Promise.all(Object.values(users)
      .filter((user) => user !== users.spock)
      .map((user) => users.spock.spark.request({
        method: 'POST',
        service: 'hydra',
        resource: 'memberships',
        body: {
          roomId: room.id,
          personId: user.id
        }
      })))));

  afterEach('disable group calling', () => Object.values(users).forEach((user) => {
    if (user) {
      // eslint-disable-next-line no-param-reassign
      user.spark.config.phone.enableExperimentalGroupCallingSupport = false;
    }
  }));

  after('unregister users', () => Promise.all(Object.entries(users).map(([name, user]) => user && user.spark.phone.deregister()
    // eslint-disable-next-line no-console
    .catch((reason) => console.warn(`could not unregister ${name}`, reason)))));
}

browserOnly(describe)('plugin-phone', function () {
  this.timeout(60000);

  describe('Call', () => {
    firefoxOnly(describe)('mid-call screen and application sharing', () => {
      let mccoy, spock;
      const users = {
        mccoy: null,
        spock: null
      };

      setup(users, () => {
        ({mccoy} = users);
        ({spock} = users);
      });

      it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(mccoy.id), async (sc) => {
        // This is more to prove our assumptions about the test than to require
        // a particular code behavior.
        assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

        const [mc] = await Promise.all([
          expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
          expectChangeLocusEvent(sc, 'spock expects to receive a locus')
            .then(() => {
              assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
              assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
              assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
            })
        ]);

        await Promise.all([
          expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
          expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
          mc.answer()
        ]);

        // Attempt to unwrap potentially previously wrapped methods.
        try {
          WebRTCMediaEngine.getUserMedia.restore();
        }
        catch (err) {
          // ignore
        }

        try {
          sc.spark.internal.locus.updateMedia.restore();
        }
        catch (err) {
          // ignore
        }

        const gumSpy = sinon.spy(WebRTCMediaEngine, 'getUserMedia');

        const updateMediaSpy = sinon.spy(sc.spark.internal.locus, 'updateMedia');

        // Firefox > 59 initialiates sendonly media as sendrecv
        // Monitor updates to adapter and FF. This will fail once the bug has been fixed
        const activeScreenDirection = browser.firefox ? 'sendrecv' : 'sendonly';
        const inactiveScreenDirection = browser.firefox ? 'recvonly' : 'inactive';

        await sc.startScreenShare();

        assert.calledWithMatch(gumSpy, {
          video: {
            mediaSource: 'screen'
          }
        });

        let audio, video, screen;

        assert.calledOnce(updateMediaSpy);
        let sdp = parse(updateMediaSpy.args[0][1].sdp);

        assert.lengthOf(sdp.media, 3);
        audio = sdp.media.find((m) => m.type === 'audio');
        assert.exists(audio, 'audio media exists');
        assert.equal(audio.direction, 'sendrecv');
        video = sdp.media.find((m) => m.type === 'video' && !m.content);
        assert.exists(video, 'video media exists');
        assert.equal(video.direction, 'sendrecv');
        screen = sdp.media.find((m) => m.type === 'video' && !!m.content);
        assert.exists(screen, 'screen media exists');
        assert.equal(screen.direction, activeScreenDirection);

        await sc.stopScreenShare();

        assert.calledTwice(updateMediaSpy);
        sdp = parse(updateMediaSpy.args[1][1].sdp);

        assert.lengthOf(sdp.media, 3);
        audio = sdp.media.find((m) => m.type === 'audio');
        assert.exists(audio, 'audio media exists');
        assert.equal(audio.direction, 'sendrecv');
        video = sdp.media.find((m) => m.type === 'video' && !m.content);
        assert.exists(video, 'video media exists');
        assert.equal(video.direction, 'sendrecv');
        screen = sdp.media.find((m) => m.type === 'video' && !!m.content);
        assert.exists(screen, 'screen media exists');
        assert.equal(screen.direction, inactiveScreenDirection);

        await sc.startApplicationShare();

        assert.calledWithMatch(gumSpy, {
          video: {
            mediaSource: 'application'
          }
        });

        assert.calledThrice(updateMediaSpy);
        sdp = parse(updateMediaSpy.args[0][1].sdp);

        assert.lengthOf(sdp.media, 3);
        audio = sdp.media.find((m) => m.type === 'audio');
        assert.exists(audio, 'audio media exists');
        assert.equal(audio.direction, 'sendrecv');
        video = sdp.media.find((m) => m.type === 'video' && !m.content);
        assert.exists(video, 'video media exists');
        assert.equal(video.direction, 'sendrecv');
        screen = sdp.media.find((m) => m.type === 'video' && !!m.content);
        assert.exists(screen, 'application screen media exists');
        assert.equal(screen.direction, activeScreenDirection);
      }));
    });
  });
});
