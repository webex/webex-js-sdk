/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {defaults, includes} from 'lodash';
import fh from '@ciscospark/test-helper-file';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';


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

  beforeEach(() => testUsers.create({count: 1})
    .then((users) => {
      spark = new CiscoSpark({
        credentials: {
          authorization: users[0].token
        }
      });
    }));

  describe(`#submitCallLogs()`, function() {
    it(`uploads call logs for authUser`, function() {
      return spark.support.submitCallLogs({}, sampleTextOne)
        .then(function(body) {
          assert.isDefined(body);
          assert.isDefined(body.url);
        });
    });
  });

  describe(`#submitCallLogsForUnAuthUser()`, function() {
    it(`uploads call logs for unAuthUser @atlas and returns the userId`, function() {
      spark = new CiscoSpark({});
      return spark.support.submitCallLogs({}, sampleTextOne)
        .then(function(body) {
          assert.isDefined(body);
          assert.isDefined(body.url);
          assert.isDefined(body.userId);
        });
    });
  });

  describe(`#_constructFileMetadata()`, function() {
    it(`constructs a sample File Meta Data`, function() {
      spark.client = {trackingIdBase : '8675309'};
      let contructedMetaData = [{key: `8675309`, value: `8675309`}];
      let result = spark.support._constructFileMetadata({});
      assert.equal(result.length, 1);
      assert.equal(result[0].key, 'trackingId');
      assert.equal(result[0].value, 'spark-js-sdk_8675309');
    });
  });

});
