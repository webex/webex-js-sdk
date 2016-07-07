/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Spark from '../..';

describe(`Spark`, () => {
  let spark;
  beforeEach(() => {
    spark = new Spark();
  });

  describe(`#logger`, () => {
    it(`exists`, () => {
      assert.property(spark, `logger`);
      assert.doesNotThrow(() => {
        spark.logger.log(`test`);
      });
    });
  });

  describe.skip(`.version`, () => {
    it(`exists`, () => {
      assert.property(Spark, `version`);
    });
  });

  describe.skip(`#version`, () => {
    it(`exists`, () => {
      assert.property(spark, `version`);
    });
  });
});
