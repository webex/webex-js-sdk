/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import file from '@ciscospark/test-helper-file';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
// import {browserOnly} from '@ciscospark/test-helper-mocha';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';

describe(`Encryption`, function() {
  this.timeout(30000);

  let key, spark;

  const PLAINTEXT = `Admiral, if we go "by the book". like Lieutenant Saavik, hours could seem like days.`;
  let FILE = makeLocalUrl(`/sample-image-small-one.png`);

  before(() => testUsers.create({count: 1})
    .then((users) => {
      const user = users[0];
      spark = new CiscoSpark({
        credentials: {
          authorization: user.token
        }
      });
      assert.isTrue(spark.isAuthenticated);

      return spark.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {key = k;});
    }));

  before(() => spark.request({
    uri: FILE,
    responseType: `buffer`
  })
    .then((res) => {FILE = res.body;}));

  after(() => spark && spark.mercury.disconnect());

  describe(`#decryptBinary()`, () => {
    it(`decrypts a binary file`, () => spark.encryption.encryptBinary(FILE)
      .then(({scr, cdata}) => {
        scr.loc = `file:///file.enc`;
        return spark.encryption.encryptScr(key, scr)
          .then((cipherScr) => spark.encryption.decryptScr(key, cipherScr))
          .then((decryptedScr) => spark.encryption.decryptBinary(decryptedScr, cdata))
          .then((f) => assert.deepEqual(f, FILE));
      }));
  });

  describe(`#decryptScr()`, () => {
    it(`decrypts an scr`, () => spark.encryption.encryptBinary(FILE)
      .then(({scr}) => {
        scr.loc = `file:///file.enc`;
        return spark.encryption.encryptScr(key, scr)
          .then((cipherScr) => spark.encryption.decryptScr(key, cipherScr))
          .then((decryptedScr) => assert.deepEqual(decryptedScr, scr));
      }));
  });

  describe(`#decryptText()`, () => {
    it(`decrypts text`, () => spark.encryption.encryptText(key, PLAINTEXT)
      .then((ciphertext) => {
        assert.notEqual(ciphertext, PLAINTEXT);
        return spark.encryption.decryptText(key, ciphertext);
      })
      .then((plaintext) => assert.equal(plaintext, PLAINTEXT)));
  });

  describe(`#getKey()`, () => {
    let fetchKeySpy, otherSpark, otherUser, storageGetSpy;
    before(() => testUsers.create({count: 1})
      .then((users) => {
        otherUser = users[0];
        otherSpark = new CiscoSpark({
          credentials: {
            authorization: otherUser.token
          }
        });
        assert.isTrue(otherSpark.isAuthenticated);
      }));

    before(() => spark.encryption.kms.createResource({
      key,
      userIds: [
        spark.device.userId,
        otherUser.id
      ]
    }));

    after(() => otherSpark && otherSpark.mercury.disconnect());

    beforeEach(() => {
      fetchKeySpy = sinon.spy(otherSpark.encryption.kms, `fetchKey`);
      storageGetSpy = sinon.spy(otherSpark.encryption.unboundedStorage, `get`);
    });

    afterEach(() => {
      fetchKeySpy.restore();
      storageGetSpy.restore();
    });

    it(`shortcircuits if it receives a key instead of a keyUri`, () => spark.encryption.getKey(key)
      // Reminder: If this starts failing after a node-jose upgrade, it probably
      // implies node-jose stopped shortcircuiting correctly.
      .then((k) => assert.equal(k, key)));

    it(`attempts to retrieve the specified key from the local cache`, () => otherSpark.encryption.getKey(key.uri)
      .then((k) => assert.calledWith(storageGetSpy, k.uri)));

    it(`fetches the key from the kms`, () => otherSpark.encryption.unboundedStorage.del(key.uri)
      .then(() => assert.notCalled(fetchKeySpy))
      .then(() => otherSpark.encryption.getKey(key.uri))
      .then(() => assert.calledOnce(fetchKeySpy)));

    it(`stores the newly retrieved key`, () => otherSpark.encryption.getKey(key.uri)
      .then((k) => otherSpark.encryption.unboundedStorage.get(k.uri))
      .then((str) => JSON.parse(str))
      .then((k2) => {
        assert.property(k2, `jwk`);
        assert.property(k2.jwk, `k`);
        assert.equal(key.jwk.kid, k2.jwk.kid);
      }));
  });

  describe(`#download()`, () => {
    it(`downloads and decrypts an encrypted file`, () => spark.encryption.encryptBinary(FILE)
      .then(({scr, cdata}) => {
        return spark.request({
          method: `POST`,
          uri: makeLocalUrl(`/files/upload`),
          body: cdata
        })
          .then((res) => {
            scr.loc = makeLocalUrl(res.body.loc, {full: true});
            return spark.encryption.encryptScr(key, scr);
          });
      })
      .then((cipherScr) => spark.encryption.decryptScr(key, cipherScr))
      .then((scr) => spark.encryption.download(scr))
      .then((f) => assert.becomes(file.isMatchingFile(f, FILE), true)));

    it(`emits progress events`, () => {
      const spy = sinon.spy();
      return spark.encryption.encryptBinary(FILE)
        .then(({scr, cdata}) => {
          return spark.request({
            method: `POST`,
            uri: makeLocalUrl(`/files/upload`),
            body: cdata
          })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});
              return spark.encryption.encryptScr(key, scr);
            });
        })
        .then((cipherScr) => spark.encryption.decryptScr(key, cipherScr))
        .then((scr) => spark.encryption.download(scr)
          .on(`progress`, spy))
        .then(() => assert.called(spy));
    });
  });

  describe(`#encryptBinary()`, () => {
    it(`encrypts a binary file`, () => spark.encryption.encryptBinary(FILE)
      .then(({scr, cdata}) => {
        assert.property(scr, `enc`);
        assert.property(scr, `key`);
        assert.property(scr, `iv`);
        return assert.isBufferLike(cdata);
      }));

    // browserOnly(it)(`accepts an ArrayBuffer`);
    // browserOnly(it)(`accepts a Blob`);
  });

  describe(`#encryptScr()`, () => {
    it(`encrypts an scr`, () => spark.encryption.encryptBinary(FILE)
      .then(({scr}) => {
        scr.loc = `file:///file.enc`;
        return spark.encryption.encryptScr(key, scr);
      })
      .then((cipherScr) => assert.isString(cipherScr)));
  });

  describe(`#encryptText()`, () => {
    it(`encrypts text`, () => spark.encryption.encryptText(key, PLAINTEXT)
      .then((ciphertext) => assert.notEqual(ciphertext, PLAINTEXT)));
  });
});
