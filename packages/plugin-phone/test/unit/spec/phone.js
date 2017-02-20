/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';

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
  });
});
