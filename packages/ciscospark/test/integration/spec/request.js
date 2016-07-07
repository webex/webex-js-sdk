/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import spark from '../..';

describe(`ciscospark`, function() {
  this.timeout(60000);
  describe(`#request`, () => {
    it(`can make requests`, () => {
      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/ping`
      })
        .then((res) => {
          assert.statusCode(res, 200);
        });
    });
  });
});
