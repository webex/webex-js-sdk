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
        return assert.isRejected(spark.flag.flag({}, {}), /`activity.url` is required/);
      });
    });

    describe(`#unflag()`, () => {
      it(`requires a Flag Id`, () => {
        return assert.isRejected(spark.flag.unflag({}, {}), /`flag.id` is required/);
      });
    });

    describe(`#archive()`, () => {
      it(`requires a Flag Id`, () => {
        return assert.isRejected(spark.flag.archive({}, {}), /`flag.id` is required/);
      });
    });

    describe(`#remove()`, () => {
      it(`requires a Flag Id`, () => {
        return assert.isRejected(spark.flag.remove({}, {}), /`flag.id` is required/);
      });
    });

  });

});
