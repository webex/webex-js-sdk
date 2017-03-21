/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import Phone from '../..';
import Locus from '@ciscospark/plugin-locus';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import AmpState from 'ampersand-state';

describe(`plugin-phone`, () => {
  describe(`Phone`, () => {
    describe(`#isCallingSupported()`, () => {
      let spark;
      beforeEach(() => {
        spark = new CiscoSpark();
      });
      // This is sort of a silly test since we only actually run this test in
      // browsers that support calling...
      it(`returns true`, () => assert.becomes(spark.phone.isCallingSupported(), true));
    });

    describe(`#defaultFacingMode`, () => {
      let spark;
      beforeEach(() => {
        spark = new MockSpark({
          children: {
            device: AmpState.extend({}),
            locus: Locus,
            mercury: AmpState.extend({
              connect() {
                return Promise.resolve();
              },
              when() {
                return Promise.resolve([{
                  data: {
                    bufferState: {
                      locus: `BUFFERED`
                    }
                  }
                }]);
              }
            }),
            phone: Phone
          }
        });

        sinon.stub(spark.locus, `join`);
        sinon.stub(spark.locus, `create`);
        sinon.stub(spark.locus, `list`).returns(Promise.resolve([]));

        spark.device = {
          refresh: () => Promise.resolve()
        };
      });

      it(`defaults to user`, () => {
        assert.equal(spark.phone.defaultFacingMode, `user`);
      });

      describe(`when video constraints are not specified`, () => {
        it(`gets passed as the video constraint`, (done) => {

          const call = spark.phone.dial(`blarg`);
          call.once(`error`, done);
          sinon.stub(call.media, `createOffer`, () => {
            try {
              assert.isTrue(call.media.audioConstraint);
              assert.deepEqual(call.media.videoConstraint, {
                facingMode: {
                  exact: `user`
                }
              });
              done();
            }
            catch (err) {
              done(err);
            }
          });
        });
      });

      describe(`when video constraints are specified`, () => {
        it(`does not get passed as the video constraint`, (done) => {

          const call = spark.phone.dial(`blarg`, {
            constraints: {
              audio: true
            }
          });
          call.once(`error`, done);
          sinon.stub(call.media, `createOffer`, () => {
            try {
              assert.isTrue(call.media.audioConstraint);
              assert.notOk(call.media.videoConstraint);
              done();
            }
            catch (err) {
              done(err);
            }
          });
        });
      });
    });
  });
});
