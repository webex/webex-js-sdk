/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import Phone, {Call} from '@ciscospark/plugin-phone';
import {browserOnly, handleErrorEvent, maxWaitForEvent} from '@ciscospark/test-helper-mocha';
import AmpState from 'ampersand-state';
import Locus from '@ciscospark/internal-plugin-locus';
import Mercury from '@ciscospark/internal-plugin-mercury';
import Device from '@ciscospark/internal-plugin-wdm';

import {makeLocus} from '../../lib/locus';

browserOnly(describe)('plugin-phone', function () {
  this.timeout(30000);

  describe('Call', () => {
    let call;
    let spark;

    afterEach(() => {
      call.parent.internal.mercury.removeAllListeners();
      call.parent.off();
      call.off();
    });

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device,
          locus: Locus,
          mercury: Mercury,
          phone: Phone,
          people: AmpState.extend({
            inferPersonIdFromUuid: (uuid) => uuid
          })
        }
      });

      sinon.stub(spark.internal.mercury, 'connect').returns(Promise.resolve());

      spark.internal.device.url = 'https://example.com/devices/1';
      spark.config.phone = {
        audioBandwidthLimit: 64000,
        videoBandwidthLimit: 1000000
      };
    });

    function makeCall() {
      return new Call({
        parent: spark
      });
    }

    describe('#internalCallId', () => {
      it('is derived from the locus url and last updated time', () => {
        call = makeCall();
        const locus = makeLocus({});
        call.locus = locus;
        assert.equal(call.internalCallId, 'https://example.com/locus/1_1');
      });

      it('is undefined when dialing', () => {
        call = spark.phone.dial('test@example.com');
        assert.isUndefined(call.internalCallId);
      });

      it('gets defined when the dial() call completes', () => {
        sinon.stub(spark.internal.locus, 'create').returns(Promise.resolve(makeLocus({})));
        return handleErrorEvent(spark.phone.dial('test@example.com'), (c) => {
          call = c;

          sinon.stub(call.media, 'createOffer').returns(Promise.resolve());
          sinon.stub(call.media, 'acceptAnswer').returns(Promise.resolve());

          assert.isUndefined(call.internalCallId);

          return maxWaitForEvent(1000, 'change:locus', call)
            .then(() => {
              assert.isDefined(call.locus);
              assert.isDefined(call.internalCallId);
              assert.equal(call.internalCallId, 'https://example.com/locus/1_1');
            });
        });
      });

      it('gets defined when a mercury message with matching correlation id is received', () => {
        // eslint-disable-next-line no-empty-function
        sinon.stub(spark.internal.locus, 'create').returns(new Promise(() => {}));
        return handleErrorEvent(spark.phone.dial('test@example.com'), (c) => {
          call = c;
          sinon.stub(call.media, 'createOffer').returns(Promise.resolve());
          assert.isUndefined(call.internalCallId);
          return maxWaitForEvent(1000, 'change:correlationId', call)
            .then(() => {
              assert.isDefined(call.correlationId, 'The call has a correlation id');
              spark.internal.mercury.trigger('event:locus.difference', {
                data: {
                  locus: makeLocus({correlationId: call.correlationId})
                }
              });
              return maxWaitForEvent(1000, 'change:locus', call);
            })
            .then(() => {
              assert.isDefined(call.locus, 'The call has a locus');
              assert.isDefined(call.internalCallId, 'The call has an internal call id');
              assert.equal(call.internalCallId, 'https://example.com/locus/1_1', 'The call has the expected internal call id');
            });
        });
      });
    });

    describe('on(localMediaStream:change)', () => {
      it('gets triggered when the localMediaStream is updated', () => {
        call = makeCall();
        const spy = sinon.spy();
        call.on('localMediaStream:change', spy);
        assert.notOk(call.localMediaStream);
        return navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
          fake: true
        })
          .then((stream) => {
            assert.notCalled(spy);
            call.localMediaStream = stream;
            // We fire once to set localMediaStream to stream, and then again to
            // set localMediaStram back to media.localMediaStream
            assert.calledTwice(spy);
          });
      });
    });

    describe('on(remoteMediaStream:change)', () => {
      it('gets triggered when the remoteMediaStream is updated', () => {
        call = makeCall();
        const spy = sinon.spy();
        call.on('remoteMediaStream:change', spy);

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
