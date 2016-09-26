/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

import {assert} from '@ciscospark/test-helper-chai';
import Flag from '../..';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe(`plugin-flag`, () => {
  describe(`Flag`, () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          flag: Flag
        }
      });
    });

    describe(`#flag()`, () => {
      it(`requires an activity URL`, () => {
        return assert.isRejected(spark.flag.create({}, {}), /`activity.url` is required/);
      });
    });

  });

});
