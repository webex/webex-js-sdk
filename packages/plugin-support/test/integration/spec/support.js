/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import fh from '@ciscospark/test-helper-file';
import testUsers from '@ciscospark/test-helper-test-users';


describe(`plugin-support`, function() {
  this.timeout(20000);

  let spark;

  let sampleTextOne = `sample-text-one.txt`;

  before(() => Promise.all([
    fh.fetch(sampleTextOne)
  ])
    .then((res) => {
      [
        sampleTextOne
      ] = res;
    }));

  describe(`#submitLogs()`, () => {
    describe(`when the current user is not authorized`, () => {
      before(() => testUsers.create({count: 1})
        .then((users) => {
          spark = new CiscoSpark({
            credentials: {
              authorization: users[0].token
            }
          });
        }));

      it(`uploads logs`, () => spark.support.submitLogs({}, sampleTextOne)
        .then((body) => {
          // Not sure what to assert here.
          // In the case of an authorized user, the body should be empty {}
          console.log(body);
          assert.isDefined(body);
        }));
    });

    describe(`when the current user is not authorized`, () => {
      it(`uploads logs`, () => {
        spark = new CiscoSpark({});
        return spark.support.submitLogs({}, sampleTextOne)
          .then((body) => {
            assert.isDefined(body);
            assert.isDefined(body.url);
            assert.isDefined(body.userId);
          });
      });
    });
  });

});
