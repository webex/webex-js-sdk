/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {MetricsBatcher, PAYLOAD_KEY_SYMBOL} from '../..';

describe(`Metrics`, () => {
  describe(`Batcher`, () => {
    let batch;
    let spark;

    beforeEach(() => {
      spark = {
        request: sinon.spy(),
        config: {
          metrics: {}
        }
      };

      batch = new MetricsBatcher({}, {parent: spark});
    });

    describe(`#batchWillReceiveRequest()`, () => {
      it(`adds an id usable by #generateKey() but otherwise non-serializable`, () => {
        return Promise.resolve(batch.batchWillReceiveRequest({}))
          .then((payload) => {
            assert.property(payload, PAYLOAD_KEY_SYMBOL);
            assert.isDefined(payload[PAYLOAD_KEY_SYMBOL]);
          });
      });
    });

    describe(`#batchDidReceiveRequest()`, () => {
      it(`assigns common payload data`, () => {
        return Promise.resolve(batch.batchWillReceiveRequest({}))
          .then((payload) => {
            assert.property(payload, `appType`);
            assert.property(payload, `env`);
            assert.property(payload, `version`);
            assert.property(payload, `time`);
          });
      });
    });

    describe(`#requestWillFail`, () => {
      it(`reenqueues metrics in event of network failure`);
    });
  });
});
