/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Support from '../..';

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe(`plugin-support`, function() {
  this.timeout(20000);

  let spark;

  beforeEach(() => {
    spark = new MockSpark({
      children: {
        support: Support
      }
    });
  });

  describe(`#_constructFileMetadata()`, () => {
    it(`constructs a sample File Meta Data`, () => {
      const result = spark.support._constructFileMetadata({});

      assert.equal(result.length, 1);
      assert.deepEqual(result, [{
        key: `trackingId`,
        value: `mock-spark_88888888-4444-4444-4444-aaaaaaaaaaaa`
      }]);
    });
  });

});
