/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import retry from '@ciscospark/test-helper-retry';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import handleErrorEvent from '../lib/handle-error-event';
import {SparkHttpError} from '@ciscospark/spark-core';

describe(`plugin-phone`, function() {
  this.timeout(30000);

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

    beforeEach(`wait for spock's calls to end`, function() {
      this.timeout(retry.timeout(20000));
      return retry(() => spock && spock.spark.locus.list()
        .then((loci) => {
          if (loci.length) {
            return spock.spark.locus.leave({self: {url: loci[0].self.url}})
              .catch((reason) => {
                if (!(reason instanceof SparkHttpError.NotFound)) {
                  throw reason;
                }
              })
              .then(() => {
                throw new Error(`spock still has active calls`);
              });
          }
          return Promise.resolve();
        }));
    });

    beforeEach(`wait for mccoy's calls to end`, function() {
      this.timeout(retry.timeout(20000));
      return retry(() => mccoy && mccoy.spark.locus.list()
        .then((loci) => {
          if (loci.length) {
            return mccoy.spark.locus.leave({self: {url: loci[0].self.url}})
              .catch((reason) => {
                if (!(reason instanceof SparkHttpError.NotFound)) {
                  throw reason;
                }
              })
              .then(() => {
                throw new Error(`mccoy still has active calls`);
              });
          }
          return Promise.resolve();
        }));
    });

    describe(`#id`, () => {
      // TODO [SSDK-572] need call id
      it(`identifies the local party's leg of the call`);
    });

    describe(`#sessionId`, () => {
      // TODO [SSDK-573]
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
        it(`is "initiated"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => {
              assert.equal(c.status, `initiated`);
              return call.hangup();
            }));
        });
      });

      describe(`when the remote party has acknowledged the call`, () => {
        it(`is "ringing"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => Promise.all([
              c.acknowledge(),
              call.when(`ringing`)
                .then(() => assert.equal(call.status, `ringing`))
            ])));
        });
      });

      describe(`when the receiving party joins the call`, () => {
        it(`is "connected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
          ]));
        });
      });

      describe(`when the local party has left the call`, () => {
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => {
                assert.equal(call.status, `connected`);
                return call.hangup();
              }),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]));
        });
      });

      describe(`when the remote party has left the call`, () => {
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()
                .then(() => c.hangup())),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`)),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]));
        });
      });

      describe(`when the receiving party has declined the call`, () => {
        it(`is "disconnected"`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, `initiated`);
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.reject()),
            call.when(`disconnected`)
              .then(() => assert.equal(call.status, `disconnected`))
          ]));
        });
      });
    });

    describe(`#to`, () => {
      let call;
      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      it(`represents the receiving party`, () => {
        call = spock.spark.phone.dial(mccoy.email);
        return handleErrorEvent(call, () => Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => {
              return assert.equal(call.to.person.email, mccoy.email);
            })
        ]));
      });
    });

    describe(`#from`, () => {
      let call;
      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      it(`represents the initiating party`, () => {
        call = spock.spark.phone.dial(mccoy.email);
        return handleErrorEvent(call, () => Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => {
              return assert.equal(call.from.person.email, spock.email);
            })
        ]));
      });
    });

    describe(`#direction`, () => {
      it(`indicates the initiating and receiving members of the call`, () => {
        const call = spock.spark.phone.dial(mccoy.email);
        assert.equal(call.direction, `out`);
        return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
          .then(([c]) => {
            assert.equal(call.direction, `out`);
            assert.property(c, `locus`);
            assert.isDefined(c.locus);
            assert.property(c, `direction`);
            assert.isDefined(c.direction);
            assert.equal(c.direction, `in`);
          }));
      });
    });

    describe(`#remoteMediaStream`, () => {
      let call;
      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`before the call is connected`, () => {
        it(`is null`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.remoteMediaStream, null);
          return handleErrorEvent(call, () => mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()));
        });
      });

      describe(`after the call is connected`, () => {
        it(`is a media stream`, () => {
          call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.remoteMediaStream, null);
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            new Promise((resolve, reject) => {
              call.on(`connected`, () => {
                try {
                  assert.instanceOf(call.remoteMediaStream, MediaStream);
                  assert.isDefined(call.remoteMediaStreamUrl);
                  resolve();
                }
                catch (err) {
                  reject(err);
                }
              });
            })
          ]));
        });
      });
    });

    describe(`#sendingAudio`, () => {
      let call;
      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`when the local party is sending Audio`, () => {
        it(`is true`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isTrue(call.sendingAudio))
          ]));
        });
      });

      describe(`when the local party is not sending Audio`, () => {
        it(`is false`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: false, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isFalse(call.sendingAudio))
          ]));
        });
      });
    });

    describe(`#sendingVideo`, () => {
      let call;

      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`when the local party is sending Video`, () => {
        it(`is true`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isTrue(call.sendingVideo))
          ]));
        });
      });

      describe(`when the local party is not sending Video`, () => {
        it(`is false`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: false}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isFalse(call.sendingVideo))
          ]));
        });
      });
    });

    describe(`#receivingAudio`, () => {
      let call;

      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`when the local party is receiving Audio`, () => {
        it(`is true`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isTrue(call.receivingAudio))
          ]));
        });
      });

      describe(`when the local party is not receiving Audio`, () => {
        it(`is false`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: false, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isFalse(call.receivingAudio))
          ]));
        });
      });
    });

    describe(`#receivingVideo`, () => {
      let call;
      beforeEach(() => {
        call = spock.spark.phone.dial(mccoy.email);
        return handleErrorEvent(call, () => Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => assert.equal(call.status, `connected`))
        ]));
      });

      afterEach(() => {
        const c = call;
        call = undefined;
        return c.hangup().catch((reason) => console.warn(reason));
      });

      describe(`when the local party is receiving Video`, () => {
        it(`is true`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: true}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isTrue(call.receivingVideo))
          ]));
        });
      });

      describe(`when the local party is not receiving Video`, () => {
        it(`is false`, () => {
          call = spock.spark.phone.dial(mccoy.email, {constraints: {audio: true, video: false}});
          return handleErrorEvent(call, () => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.status, `connected`))
              .then(() => assert.isFalse(call.receivingVideo))
          ]));
        });
      });
    });

    describe(`#answer()`, () => {
      it(`accepts an incoming call`, () => {
        const call = mccoy.spark.phone.dial(spock.email);
        return handleErrorEvent(call, () => Promise.all([
          spock.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => assert.equal(call.status, `connected`))
        ]));
      });

      it(`is a noop for outbound calls`, () => handleErrorEvent(spock.spark.phone.dial(mccoy.id), (call) => {
        sinon.spy(call, `_join`);
        return assert.isFulfilled(call.answer())
          .then(() => {
            // We called _join to create the call
            assert.calledWith(call._join, `create`);
            // But we did not call _join when we invoked answer()
            assert.neverCalledWith(call._join, `join`);
          });
      }));

      it(`is a noop for answered calls`, () => handleErrorEvent(spock.spark.phone.dial(mccoy.id), () => {
        return mccoy.spark.phone.when(`call:incoming`)
          .then(([c]) => {
            sinon.spy(c, `_join`);
            return c.answer()
            .then(() => assert.isFulfilled(c.answer()))
              .then(() => assert.calledOnce(c._join));
          });
      }));
    });

    describe(`#hangup()`, () => {
      it(`ends an in-progress call`, () => {
        const handler = handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
          let mccoyCall;
          return Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => {
                handler.add(c);
                mccoyCall = c;
                c.answer();
              }),
            call.when(`connected`)
          ])
            .then(() => {
              call.hangup();
              return Promise.all([
                call.when(`disconnected`)
                  .then(() => assert.equal(call.status, `disconnected`)),
                mccoyCall.when(`disconnected`)
                  .then(() => assert.equal(mccoyCall.status, `disconnected`))
              ]);
            });
        });

        return handler;
      });

      it(`gets called when the local party is the last member of the call`, () => {
        const handler = handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
          let mccoyCall;
          const handler = Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => {
                handler.add(c);
                mccoyCall = c;
                return c.answer();
              }),
            call.when(`connected`)
          ])
            .then(() => {
              assert.equal(call.status, `connected`);
              assert.equal(mccoyCall.status, `connected`);
              const hangupSpy = sinon.spy(call, `hangup`);
              mccoyCall.hangup();
              return call.when(`disconnected`)
                .then(() => assert.called(hangupSpy));
            });
        });

        return handler;
      });

      describe(`when the remote party has not yet answered`, () => {
        it(`ends the call`, () => {
          const handler = handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
            const p = mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => {
                handler.add(c);
                assert.equal(c.status, `initiated`);
                return Promise.all([
                  call.hangup(),
                  c.when(`disconnected`, () => assert.equal(c.status, `disconnected`))
                ]);
              });
            return p;
          });
          return handler;
        });
      });
    });

    describe(`#reject()`, () => {
      it(`declines an incoming call`, () => {
        return handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => {
              c.reject();
            }),
          call.when(`disconnected`)
            .then(() => assert.equal(call.status, `disconnected`))
        ]));
      });

      it(`is a noop for outbound calls`, () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
        return Promise.all([
          call.reject(),
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.acknowledge()),
          call.when(`ringing`)
        ])
          .then(() => assert.equal(call.status, `ringing`));
      }));

      it(`is a noop for answered calls`, () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
        return Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => call.reject())
        ])
          .then(() => assert.equal(call.status, `connected`));
      }));
    });

    describe(`#toggleFacingMode`, () => {
      describe(`when the facing mode is "user"`, () => {
        it(`changes the facing mode to "environment"`, () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
          mccoy.spark.phone.when(`call:incoming`)
            .then(([c]) => c.answer()),
          call.when(`connected`)
            .then(() => assert.equal(call.facingMode, `user`))
            .then(() => call.toggleFacingMode())
            .then(() => assert.equal(call.facingMode, `environment`))
        ])));
      });

      describe(`when the facing mode is "environment"`, () => {
        it(`changes the facing mode to "user"`, () => {
          spock.spark.phone.defaultFacingMode = `environment`;
          return handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
            mccoy.spark.phone.when(`call:incoming`)
              .then(([c]) => c.answer()),
            call.when(`connected`)
              .then(() => assert.equal(call.facingMode, `environment`))
              .then(() => call.toggleFacingMode())
              .then(() => assert.equal(call.facingMode, `user`))
          ]));
        });
      });
    });

    describe(`triggered events`, () => {
      describe(`connection events`, () => {
        let call;
        let triggerSpy;
        beforeEach(() => {
          call = spock.spark.phone.dial(mccoy.email);
          triggerSpy = sinon.spy(call, `trigger`);
          assert.equal(call.status, `initiated`);
        });

        describe(`on(ringing)`, () => {
          it(`gets triggered when the remote party acknowledges the call`, () => {
            return handleErrorEvent(call, () => Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => {
                  c.acknowledge();
                  c.answer();
                }),
              call.when(`ringing`)
                .then(() => assert.calledWith(triggerSpy, `ringing`)),
              call.when(`connected`)
                .then(() => call.hangup())
            ]));
          });
        });

        describe(`on(connected)`, () => {
          it(`gets triggered when the call is connected`, () => {
            return handleErrorEvent(call, () => Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => {
                  c.acknowledge();
                  c.answer();
                }),
              call.when(`connected`)
                .then(() => assert.calledWith(triggerSpy, `connected`))
                .then(() => call.hangup())
            ]));
          });
        });

        describe(`on(disconnected)`, () => {
          it(`gets triggered when the call is disconnected`, () => {
            return handleErrorEvent(call, () => Promise.all([
              mccoy.spark.phone.when(`call:incoming`)
                .then(([c]) => {
                  c.acknowledge();
                  c.answer();
                }),
              call.when(`connected`)
                .then(() => call.hangup()),
              call.when(`disconnected`)
                .then(() => assert.calledWith(triggerSpy, `disconnected`))
            ]));
          });
        });
      });
    });

    describe(`on(error)`, () => {
      it(`gets triggered when something fails in a non-promise-returning method`, () => {
        this.timeout(30000);
        const call = spock.spark.phone.dial(`no one`);

        const errorSpy = sinon.spy();
        call.on(`error`, errorSpy);
        return call.when(`error`)
          .then(() => assert.called(errorSpy));
      });
    });
  });
});
