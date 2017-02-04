/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import testUsers from '@ciscospark/test-helper-test-users';
import request from 'supertest';
import {assert} from '@ciscospark/test-helper-chai';
import url from 'url';

describe(`passport-ciscospark`, () => {
  describe(`the initilization url`, () => {
    it(`initiatates the login flow`, () => request(`http://localhost:${process.env.FIXTURE_PORT}`)
      .get(`/auth/ciscospark`)
      .expect(302)
      .expect(`Location`, /idbroker/)
      .expect((res) => {
        const {query} = url.parse(res.headers.location, true);
        assert.property(query, `client_id`);
        assert.property(query, `redirect_uri`);
        assert.property(query, `response_type`);
        assert.property(query, `scope`);
        assert.equal(query.response_type, `code`);
      })
  );
  });

  describe(`the callback url`, () => {
    let user;
    before(() => testUsers.create({
      config: {
        authCodeOnly: true
      }
    })
      .then((users) => {
        user = users[0];
      }));

    it(`completes the login flow`, () => request(`http://localhost:${process.env.FIXTURE_PORT}`)
      .get(`/?code=${user.token.auth_code}`)
      .expect(200)
      .expect((res) => {
        assert.include(res.body.id, user.id);
      })
    );
  });
});
