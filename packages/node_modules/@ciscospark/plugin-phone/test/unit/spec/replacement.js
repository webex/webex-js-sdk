/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import Phone from '@ciscospark/plugin-phone';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Locus from '@ciscospark/internal-plugin-locus';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {browserOnly, maxWaitForEvent} from '@ciscospark/test-helper-mocha';
import Mercury from '@ciscospark/internal-plugin-mercury';
import Device from '@ciscospark/internal-plugin-wdm';
import AmpState from 'ampersand-state';

import {makeLocusEvent} from '../../lib/locus';

browserOnly(describe)('plugin-phone', () => {
  let spark;
  beforeEach(() => {
    spark = new MockSpark({
      children: {
        device: Device,
        mercury: Mercury,
        locus: Locus,
        phone: Phone,
        people: AmpState.extend({
          inferPersonIdFromUuid: (uuid) => uuid
        })
      }
    });
    spark.config.phone = {
      audioBandwidthLimit: 64000,
      videoBandwidthLimit: 1000000
    };
  });

  describe('Phone', () => {
    describe('when a locus gets replaced', () => {
      it('does not emit call:incoming events for previously a replaced call', () => {
        const spy = sinon.spy();
        spark.phone.on('call:incoming', spy);
        spark.internal.mercury._onmessage(makeLocusEvent({
          id: 1,
          lastActive: 1
        }));
        return Promise.resolve()
          .then(() => {
            assert.calledOnce(spy);
            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 1,
              lastActive: 1
            }));
          })
          .then(() => {
            assert.calledOnce(spy);
            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 1,
              lastActive: 2
            }));
          })
          .then(() => {
            assert.calledTwice(spy);
          });
      });

      it('continues emitting call:incoming events for the original locus *if the lastActive time changes*', () => {
        const spy = sinon.spy();
        spark.phone.on('call:incoming', spy);
        spark.internal.mercury._onmessage(makeLocusEvent({
          id: 1,
          lastActive: 1
        }));
        return Promise.resolve()
          .then(() => {
            assert.calledOnce(spy);
            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 2,
              lastActive: 1,
              replaces: {
                id: 1,
                lastActive: 1
              }
            }));
          })
          .then(() => {
            assert.calledOnce(spy);
            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 1,
              lastActive: 1
            }));
          })
          .then(() => {
            assert.calledOnce(spy);
            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 1,
              lastActive: 2
            }));
          })
          .then(() => {
            assert.calledTwice(spy);
          });
      });
    });
  });

  describe('Call', () => {
    describe('when its locus gets replaced', () => {
      it('its url changes but its internalCallId does not', () => {
        const spy = sinon.spy();
        spark.phone.on('call:incoming', spy);
        spark.internal.mercury._onmessage(makeLocusEvent({
          id: 1,
          lastActive: 1
        }));
        return Promise.resolve()
          .then(() => {
            assert.calledOnce(spy);
            assert.equal(spy.args[0][0].locusUrl, 'https://example.com/locus/1');
            assert.equal(spy.args[0][0].internalCallId, 'https://example.com/locus/1_1');

            spark.internal.mercury._onmessage(makeLocusEvent({
              id: 2,
              lastActive: 1,
              replaces: {
                id: 1,
                lastActive: 1
              },
              sequence: [1, 2]
            }));
            return maxWaitForEvent(1000, 'change:locusUrl', spy.args[0][0]);
          })
          .then(() => {
            assert.equal(spy.args[0][0].locusUrl, 'https://example.com/locus/2');
            assert.equal(spy.args[0][0].internalCallId, 'https://example.com/locus/1_1');
            assert.calledOnce(spy);
          });
      });
    });

    describe('when two loci get replaced by the same locus', () => {
      describe('when neither locus is joined', () => {
        it('transitions one to "replaced" and the other becomes the replacement', () => {
          const spy = sinon.spy();
          spark.phone.on('call:incoming', spy);
          spark.internal.mercury._onmessage(makeLocusEvent({
            id: 1,
            lastActive: 1
          }));
          spark.internal.mercury._onmessage(makeLocusEvent({
            id: 2,
            lastActive: 1
          }));

          let bricked, replaced;

          return Promise.resolve()
            .then(() => {
              assert.calledTwice(spy);
              const [callZeroArgs, callOneArgs] = spy.args;
              [bricked] = callZeroArgs;
              [replaced] = callOneArgs;

              spark.internal.mercury._onmessage(makeLocusEvent({
                id: 3,
                lastActive: 1,
                replaces: [{
                  id: 1,
                  lastActive: 1
                }, {
                  id: 2,
                  lastActive: 1
                }],
                sequence: [1, 2]
              }));

              return Promise.all([
                maxWaitForEvent(1000, 'change:status', bricked),
                maxWaitForEvent(1000, 'change:locusUrl', replaced)
              ]);
            })
            .then(() => {
              // TODO base the "active" one on the order of the replacements list?
              assert.calledTwice(spy);

              assert.equal(bricked.status, 'replaced');
              assert.equal(bricked.internalCallId, 'https://example.com/locus/1_1');

              assert.equal(replaced.internalCallId, 'https://example.com/locus/2_1');
            });
        });
      });

      describe('when one locus is joined', () => {
        it('becomes the replacement and the other call transitions to "replaced"', () => {
          const spy = sinon.spy();
          spark.phone.on('call:incoming', spy);
          spark.internal.mercury._onmessage(makeLocusEvent({
            id: 1,
            lastActive: 1
          }));

          const willBrick = makeLocusEvent({
            id: 2,
            lastActive: 1
          });

          willBrick.data.data.locus.self.state = 'JOINED';

          spark.internal.mercury._onmessage(willBrick);

          let bricked, replaced;

          return Promise.resolve()
            .then(() => {
              assert.calledTwice(spy);
              const [callZeroArgs, callOneArgs] = spy.args;
              [replaced] = callZeroArgs;
              [bricked] = callOneArgs;

              assert.isTrue(bricked.joinedOnThisDevice, 'this device is joined');

              spark.internal.mercury._onmessage(makeLocusEvent({
                id: 3,
                lastActive: 1,
                replaces: [{
                  id: 1,
                  lastActive: 1
                }, {
                  id: 2,
                  lastActive: 1
                }],
                sequence: [1, 2]
              }));
            })
            .then(() => {
              assert.calledTwice(spy);

              assert.equal(bricked.status, 'replaced');
              assert.equal(bricked.internalCallId, 'https://example.com/locus/2_1');

              assert.equal(replaced.internalCallId, 'https://example.com/locus/1_1');
            });
        });
      });

      // Note: the behavior for replacing two joined loci with a third locus is
      // currently undefined.
    });
  });
});
