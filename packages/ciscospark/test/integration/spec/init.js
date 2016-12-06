/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';
import ciscospark from '../..';
import uuid from 'uuid';
import {createUser} from '@ciscospark/test-helper-appid';

describe(`ciscospark`, function() {
  this.timeout(60000);
  describe(`.init`, () => {
    let user;
    before(() => testUsers.create({count: 1})
      .then(([u]) => {user = u;}));

    it(`creates a new authenticated spark instance`, () => {
      /* eslint camelcase: [0] */
      const spark = ciscospark.init({
        credentials: {
          authorization: {
            access_token: user.token.access_token
          }
        }
      });

      assert.isDefined(spark.config.hydraServiceUrl);

      assert.property(spark, `credentials`);
      assert.property(spark.credentials, `authorization`);
      assert.property(spark.credentials.authorization, `access_token`);
      assert.isDefined(spark.credentials.authorization.access_token);
      assert.isAbove(spark.credentials.authorization.access_token.length, 0);

      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/people/me`
      })
        .then((res) => assert.statusCode(res, 200));
    });

    it(`creates a new authenticated spark instance via shorthand credentials`, () => {
      /* eslint camelcase: [0] */
      const spark = ciscospark.init({
        credentials: user.token
      });

      assert.isDefined(spark.config.hydraServiceUrl);

      assert.property(spark, `credentials`);
      assert.property(spark.credentials, `authorization`);
      assert.property(spark.credentials.authorization, `access_token`);
      assert.isDefined(spark.credentials.authorization.access_token);
      assert.isAbove(spark.credentials.authorization.access_token.length, 0);

      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/people/me`
      })
        .then((res) => assert.statusCode(res, 200));
    });

    it(`creates a new authenticated spark instance via very shorthand credentials`, () => {
      /* eslint camelcase: [0] */
      const spark = ciscospark.init({
        access_token: user.token.access_token
      });

      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/people/me`
      })
        .then((res) => assert.statusCode(res, 200));
    });

    it(`creates a new authenticated spark instance via JWT token`, () => createUser({subject: `test-${uuid.v4()}`})
      .then(({jwt}) => {
        const spark = ciscospark.init({jwt});
        return spark.request({
          uri: `${spark.config.hydraServiceUrl}/people/me`
        });
      })
      .then((res) => assert.statusCode(res, 200)));

    it(`accepts a JWT refresh callback`, () => {
      const id = {subject: `test-${uuid.v4()}`};
      return createUser(id)
        .then(({jwt}) => {
          const spark = ciscospark.init({
            jwt,
            requestJWT() {
              return createUser(id)
                .then((res) => {
                  assert.isDefined(res.jwt);
                  return res;
                });
            }
          });

          // This test is going to need to evolve once plugin credentials lands.
          // Rather than reading the access token, we'll need to grab it with an
          // api call. Additionally, plugin-credentials will need to provide
          // isAuthenticated and isAuthenticating for some time.
          let originalAccessToken;
          return spark.authenticate({jwt})
            .then(() => {
              assert.isTrue(spark.isAuthenticated);
              originalAccessToken = spark.credentials.authorization.access_token;
              return spark.refresh({force: true});
            })
            .then(() => assert.isTrue(spark.isAuthenticated))
            .then(() => assert.notEqual(spark.credentials.authorization.access_token, originalAccessToken));
        });
    });

    it(`emits an error event if initial JWT auth fails`, (done) => {
      const spy = sinon.spy();
      const spark = ciscospark.init({
        jwt: `not a token`
      });

      spark.on(`error`, spy);
      spark.on(`error`, () => {
        assert.calledOnce(spy);
        done();
      });
      assert.notCalled(spy);
    });
  });
});
