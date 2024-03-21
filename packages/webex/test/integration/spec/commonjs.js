/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';

describe('webex', () => {
  describe('commonjs', () => {
    it('loads correctly when required in the commonjs style', () => {
      // eslint-disable-next-line global-require
      const Webex = require('webex');
      const webex = new Webex();

      assert.property(webex, 'canAuthorize');
      assert.property(webex, 'credentials');
      assert.property(webex, 'meetings');
      assert.property(webex, 'memberships');
      assert.property(webex, 'messages');
      assert.property(webex, 'people');
      assert.property(webex, 'rooms');
      assert.property(webex, 'teamMemberships');
      assert.property(webex, 'teams');
      assert.property(webex, 'webhooks');
    });
  });
});
