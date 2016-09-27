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

  before(() => testUsers.create({count: 1})
    .then((users) => {
      spark = new CiscoSpark({
        credentials: {
          authorization: users[0].token
        }
      });
    }));


  describe(`#_constructFileMetadata()`, () => {
    it(`constructs a sample File Meta Data`, () => {
      spark.client = {trackingIdBase : '8675309'};
      let contructedMetaData = [{key: `8675309`, value: `8675309`}];
      let result = spark.support._constructFileMetadata({});
      assert.equal(result.length, 1);
      assert.equal(result[0].key, 'trackingId');
      assert.equal(result[0].value, 'spark-js-sdk_8675309');
    });
  });

});
