/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

describe(`Encryption`, function() {
  this.timeout(30000);
  describe(`KMS`, () => {
    let spark, user;

    before(() => testUsers.create({count: 1})
      .then((users) => {
        user = users[0];
        spark = new CiscoSpark({
          credentials: {
            authorization: user.token
          }
        });
        assert.isTrue(spark.isAuthenticated);
      }));

    after(() => spark && spark.mercury.disconnect());

    describe(`#createResource()`, () => {
      it(`creates a kms resource object`, () => spark.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => spark.encryption.kms.createResource({
          userIds: [spark.device.userId],
          key
        })
          .then((kro) => {
            assert.property(kro, `uri`);
            assert.property(kro, `keyUris`);
            assert.lengthOf(kro.keyUris, 1);
            assert.include(kro.keyUris, key.uri);
            assert.property(kro, `authorizationUris`);
            assert.lengthOf(kro.authorizationUris, 1);
          })));
    });

    describe(`#addAuthorization()`, () => {
      it(`authorizes a user to a key`);
      it(`authorizes a resource to a key`);
    });

    describe(`#removeAuthorization()`, () => {
      it(`deauthorizes a user from a key`);
      it(`deauthorizes a resource from a key`);
    });

    describe(`#bindKey()`, () => {
      let key2, kro;
      it(`binds a resource to a key`, () => spark.encryption.kms.createUnboundKeys({count: 2})
        .then((keys) => {
          key2 = keys[1];
          return spark.encryption.kms.createResource({
            userIds: [spark.device.userId],
            key: keys[0]
          });
        })
        .then((k) => {
          kro = k;
          return spark.encryption.kms.bindKey({kro, key: key2});
        })
        .then((key) => {
          assert.equal(key.uri, key2.uri);
          assert.property(key, `bindDate`);
          assert.property(key, `resourceUri`);
          assert.equal(key.resourceUri, kro.uri);
        }));
    });

    describe(`#createUnboundKeys()`, () => {
      it(`requests unbound keys from the KMS`, () => spark.encryption.kms.createUnboundKeys({count: 2})
        .then((keys) => {
          assert.lengthOf(keys, 2);

          const [key1, key2] = keys;

          assert.property(key1, `uri`);
          assert.property(key1, `jwk`);
          assert.property(key2, `uri`);
          assert.property(key2, `jwk`);
        }));
    });

    describe(`#fetchKey()`, () => {
      let key;
      it(`retrieves a specific key`, () => spark.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;
          return spark.encryption.kms.fetchKey({uri: key.uri});
        })
        .then((key2) => {
          assert.property(key2, `uri`);
          assert.property(key2, `jwk`);
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        }));
    });

    describe(`#ping()`, () => {
      it(`sends a ping to the kms`, () => assert.isFulfilled(spark.encryption.kms.ping())
        .then((res) => {
          assert.property(res, `status`);
          assert.equal(res.status, 200);
          assert.property(res, `requestId`);
        }));
    });

    describe(`when ecdhe negotiation times out`, () => {
      let originalKmsTimeout, spark2, spy;
      before(() => testUsers.create({count: 1})
        .then(([u]) => {
          spark2 = new CiscoSpark({
            credentials: {
              authorization: u.token
            }
          });
          assert.isTrue(spark.isAuthenticated);
        }));

      after(() => spark2 && spark2.mercury.disconnect());

      beforeEach(() => {
        originalKmsTimeout = spark2.config.encryption.kmsInitialTimeout;
        spark2.config.encryption.kmsInitialTimeout = 100;
        spy = sinon.spy(spark2.encryption.kms, `prepareRequest`);
      });

      afterEach(() => {
        spark2.config.encryption.kmsInitialTimeout = originalKmsTimeout;
      });

      afterEach(() => spy.restore());

      it(`handles late ecdhe responses`, () => assert.isFulfilled(spark2.encryption.kms.ping())
        .then(() => {
          // callCount should be at least 3:
          // 1 for the initial ping message
          // 1 when the ecdh key gets renegotiated
          // 1 when the pings gets sent again
          assert.isAbove(spy.callCount, 2, `If this test fails, we've made previously-assumed-to-be-impossible performance gains in cloudapps; please update this test accordingly.`);
        }));
    });

    describe(`when the kms is in another org`, () => {
      let fedSpark;

      before(() => testUsers.create({
        count: 1,
        config: {
          email: `spark-js-sdk--kms-fed--${uuid.v4()}@wx2.example.com`,
          entitlements: [`webExSquared`],
          orgId: `kmsFederation`
        }
      })
        .then((users) => {
          const fedUser = users[0];
          assert.equal(fedUser.orgId, `75dcf6c2-247d-4e3d-a32c-ff3ee28398eb`);
          assert.notEqual(fedUser.orgId, user.orgId);

          fedSpark = new CiscoSpark({
            credentials: {
              authorization: fedUser.token
            }
          });
          assert.isTrue(fedSpark.isAuthenticated);
          return fedSpark.mercury.connect();
        }));

      after(() => fedSpark && fedSpark.mercury.disconnect());

      it(`responds to pings`, () => assert.isFulfilled(fedSpark.encryption.kms.ping())
        .then((res) => {
          assert.property(res, `status`);
          assert.equal(res.status, 200);
          assert.property(res, `requestId`);
        }));

      let key;
      it(`lets federated users retrieve keys from the main org`, () => spark.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;
          return spark.encryption.kms.createResource({
            userIds: [
              spark.device.userId,
              fedSpark.device.userId
            ],
            key
          });
        })
        .then(() => fedSpark.encryption.kms.fetchKey({uri: key.uri}))
        .then((fedKey) => assert.equal(fedKey.keyUri, key.keyUri)));

      let fedKey;
      it(`lets non-federated users retrieve keys from the federated org`, () => fedSpark.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          fedKey = k;
          return fedSpark.encryption.kms.createResource({
            userIds: [
              fedSpark.device.userId,
              spark.device.userId
            ],
            key: fedKey
          });
        })
        .then(() => spark.encryption.kms.fetchKey({uri: fedKey.uri}))
        .then((key) => assert.equal(key.keyUri, fedKey.keyUri)));
    });
  });
});
