/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import transform from 'sdp-transform';
import {find} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';


function boolToStatus(sending, receiving) {
  if (sending && receiving) {
    return `sendrecv`;
  }

  if (sending && !receiving) {
    return `sendonly`;
  }

  if (!sending && receiving) {
    return `recvonly`;
  }

  if (!sending && !receiving) {
    return `inactive`;
  }

  throw new Error(`If you see this error, your JavaScript engine has a major flaw`);
}

function assertMedia(call, {
  sendingAudio,
  sendingVideo,
  receivingAudio,
  receivingVideo
}) {
  // Local State
  assert.equal(call.sendingAudio, sendingAudio, `The call ${sendingAudio ? `is` : `is not`} sending audio`);
  assert.equal(call.sendingVideo, sendingVideo, `The call ${sendingVideo ? `is` : `is not`} sending video`);

  // Locus State
  // FIXME reenable locus state tests once Locus team fixes cloud-apps #3939
  // assert.equal(call.local.status.audioStatus.toLowerCase(), boolToStatus(sendingAudio, receivingAudio), `Locus State`);
  // assert.equal(call.local.status.videoStatus.toLowerCase(), boolToStatus(sendingVideo, receivingVideo), `Locus State`);
  //
  // assert.equal(call.remote.status.audioStatus.toLowerCase(), boolToStatus(remoteSendingAudio, remoteReceivingAudio), `Locus State`);
  // assert.equal(call.remote.status.videoStatus.toLowerCase(), boolToStatus(remoteSendingVideo, remoteReceivingVideo), `Locus State`);

  // Media State
  const offer = transform.parse(call.pc.localDescription.sdp);
  assertPeerConnectionState(offer, `audio`, sendingAudio, receivingAudio);
  assertPeerConnectionState(offer, `video`, sendingVideo, receivingVideo);

  const answer = transform.parse(call.pc.remoteDescription.sdp);
  assertPeerConnectionState(answer, `audio`, receivingAudio, sendingAudio);
  assertPeerConnectionState(answer, `video`, receivingVideo, sendingVideo);
}

function assertPeerConnectionState(sdp, type, sending, receiving) {
  const media = find(sdp.media, {type});
  if (!sending && !receiving) {
    if (media) {
      assert.equal(media.direction, `inactive`);
    }
    return;
  }

  assert.equal(media.direction, boolToStatus(sending, receiving));
}

describe(`plugin-phone`, function() {
  this.timeout(30000);

  describe(`Call`, () => {
    describe(`Media State Controls`, () => {
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

      describe(`#toggleReceivingAudio()`, () => {
        describe(`when the call is receiving audio`, () => {
          // FIXME Neil and Nathan are looking into alternatives to returning
          // `inactive` in the answer when the offer audio attempts to be
          // `sendonly`
          it.skip(`stops receiving audio`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: false,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call is not receiving audio`, () => {
          // FIXME Neil and Nathan are looking into alternatives to returning
          // `inactive` in the answer when the offer audio attempts to be
          // `sendonly`
          it.skip(`starts receiving audio`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: false,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call was started without audio`, () => {
          // FIXME Neil and Nathan are looking into alternatives to returning
          // `inactive` in the answer when the offer audio attempts to be
          // `sendonly`
          it.skip(`starts receiving audio`, () => {
            const call = spock.spark.phone.dial(mccoy.email, {
              constraints: {
                audio: false
              }
            });

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: false,
                  sendingVideo: true,
                  receivingAudio: false,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => assert.isFalse(call.sendingAudio, `The call is not sending audio`))
                .then(() => call.toggleReceivingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: false,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });
      });

      describe(`#toggleReceivingVideo()`, () => {
        describe(`when the call is receiving video`, () => {
          // FIXME disabled due to firefox bug (it works, but renegotiation does
          // not) See https://bugzilla.mozilla.org/show_bug.cgi?id=1285009
          it.skip(`stops receiving video`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: false,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call is not receiving video`, () => {
          // FIXME disabled due to firefox bug (it works, but renegotiation does
          // not) See https://bugzilla.mozilla.org/show_bug.cgi?id=1285009
          it.skip(`starts receiving video`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: false,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleReceivingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call was started without video`, () => {
          it.skip(`starts receiving video`, () => {
            const call = spock.spark.phone.dial(mccoy.email, {
              constraints: {
                video: false
              }
            });

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: false,
                  receivingAudio: true,
                  receivingVideo: false,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => assert.isFalse(call.sendingVideo, `The call is not sending video`))
                .then(() => call.toggleReceivingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: false,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });
      });

      describe(`#toggleSendingAudio()`, () => {
        describe(`when the call is sending audio`, () => {
          it(`stops sending audio`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: false,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call has stopped sending audio`, () => {
          it(`starts sending audio`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: false,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call was started without audio`, () => {
          // FIXME Neil and Nathan are looking into alternatives to returning
          // `inactive` in the answer when the offer audio attempts to be
          // `sendonly`
          it.skip(`adds audio to the call`, () => {
            const call = spock.spark.phone.dial(mccoy.email, {
              constraints: {
                audio: false
              }
            });

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: false,
                  sendingVideo: true,
                  receivingAudio: false,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => assert.isFalse(call.sendingAudio, `The call is not sending audio`))
                .then(() => call.toggleSendingAudio())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: false,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });
      });

      describe(`#toggleSendingVideo()`, () => {
        describe(`when the call is sending video`, () => {
          it(`stops sending video`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: false,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call has stopped sending video`, () => {
          it(`starts sending video`, () => {
            const call = spock.spark.phone.dial(mccoy.email);

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: false,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: true,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });

        describe(`when the call was started without video`, () => {
          it(`adds video to the call`, () => {
            const call = spock.spark.phone.dial(mccoy.email, {
              constraints: {
                video: false
              }
            });

            return Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => c.answer()),
              call.when(`connected`)
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: false,
                  receivingAudio: true,
                  receivingVideo: false,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
                .then(() => call.toggleSendingVideo())
                .then(() => assertMedia(call, {
                  sendingAudio: true,
                  sendingVideo: true,
                  receivingAudio: true,
                  receivingVideo: false,
                  remoteSendingAudio: true,
                  remoteSendingVideo: true,
                  remoteReceivingAudio: true,
                  remoteReceivingVideo: true
                }))
            ]);
          });
        });
      });
    });
  });
});
