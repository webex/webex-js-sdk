/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';

describe('ciscospark', () => {
  describe('commonjs', () => {
    it('loads correctly when required in the commonjs style', () => {
      // eslint-disable-next-line global-require
      const CiscoSpark = require('ciscospark');
      const spark = new CiscoSpark();
      assert.property(spark, 'canAuthorize');
      assert.property(spark, 'credentials');
      assert.property(spark, 'memberships');
      assert.property(spark, 'messages');
      assert.property(spark, 'people');
      assert.property(spark, 'phone');
      assert.property(spark, 'rooms');
      assert.property(spark, 'teamMemberships');
      assert.property(spark, 'teams');
      assert.property(spark, 'webhooks');
    });
  });
});
