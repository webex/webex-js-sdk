/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../../';
import '@ciscospark/plugin-mercury';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-presence`, () => {
  describe(`Presence`, () => {

    let kirk, spock, uhura;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [kirk, spock, uhura] = users;

        kirk.spark = new CiscoSpark({
          credentials: {
            authorization: kirk.token
          }
        });

        return kirk.spark.mercury.connect();
      }));

    after(() => kirk && kirk.spark.mercury.disconnect());

    it(`retrieves the presence of a user`, () => kirk.spark.presence.get([spock, uhura])
      .then((res) => {
        console.log(res);
      }));
  });
});
