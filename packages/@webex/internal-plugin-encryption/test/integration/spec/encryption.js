/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {isBuffer} from '@webex/common';
import {assert, expect} from '@webex/test-helper-chai';
import file from '@webex/test-helper-file';
import sinon from 'sinon';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import makeLocalUrl from '@webex/test-helper-make-local-url';

describe('Encryption', function () {
  this.timeout(30000);

  let key, user, webex;

  const PLAINTEXT =
    'Admiral, if we go "by the book". like Lieutenant Saavik, hours could seem like days.';
  let FILE = makeLocalUrl('/sample-image-small-one.png');

  before('create test user', () =>
    testUsers.create({count: 1}).then((users) => {
      user = users[0];
      webex = new WebexCore({
        credentials: {
          authorization: user.token,
        },
      });
      assert.isTrue(webex.isAuthenticated || webex.canAuthorize);
    })
  );

  before('create unbound key', () =>
    webex.internal.encryption.kms.createUnboundKeys({count: 1}).then(([k]) => {
      key = k;
    })
  );

  before('fetch file fixture', () =>
    webex
      .request({
        uri: FILE,
        responseType: 'buffer',
      })
      .then((res) => {
        FILE = res.body;
      })
  );

  after(() => webex && webex.internal.mercury.disconnect());

  describe('#decryptBinary()', () => {
    it('decrypts a binary file', () =>
      webex.internal.encryption.encryptBinary(FILE).then(({scr, cdata}) => {
        scr.loc = 'file:///file.enc';

        return webex.internal.encryption
          .encryptScr(key, scr)
          .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
          .then((decryptedScr) => webex.internal.encryption.decryptBinary(decryptedScr, cdata))
          .then((f) => {
            assert.isTrue(isBuffer(f));

            return assert.equal(f.byteLength, FILE.byteLength);
          });
      }));
  });

  describe('#decryptScr()', () => {
    it('decrypts an scr', () =>
      webex.internal.encryption.encryptBinary(FILE).then(({scr}) => {
        scr.loc = 'file:///file.enc';

        return webex.internal.encryption
          .encryptScr(key, scr)
          .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
          .then((decryptedScr) => assert.deepEqual(decryptedScr, scr));
      }));
  });

  describe('#decryptText()', () => {
    it('decrypts text', () =>
      webex.internal.encryption
        .encryptText(key, PLAINTEXT)
        .then((ciphertext) => {
          assert.notEqual(ciphertext, PLAINTEXT);

          return webex.internal.encryption.decryptText(key, ciphertext);
        })
        .then((plaintext) => assert.equal(plaintext, PLAINTEXT)));
  });

  describe('#getKey()', () => {
    let fetchKeySpy, otherWebex, otherUser, storageGetSpy;

    before('create test user', () =>
      testUsers.create({count: 1}).then((users) => {
        otherUser = users[0];
        otherWebex = new WebexCore({
          credentials: {
            authorization: otherUser.token,
          },
        });
        assert.isTrue(otherWebex.canAuthorize);
      })
    );

    before('create kms resource', () =>
      webex.internal.encryption.kms.createResource({
        key,
        userIds: [webex.internal.device.userId, otherUser.id],
      })
    );

    after(() => otherWebex && otherWebex.internal.mercury.disconnect());

    beforeEach(() => {
      fetchKeySpy = sinon.spy(otherWebex.internal.encryption.kms, 'fetchKey');
      storageGetSpy = sinon.spy(otherWebex.internal.encryption.unboundedStorage, 'get');
    });

    afterEach(() => {
      fetchKeySpy.restore();
      storageGetSpy.restore();
    });

    it('shortcircuits if it receives a key instead of a keyUri', () =>
      webex.internal.encryption
        .getKey(key)
        // Reminder: If this starts failing after a node-jose upgrade, it probably
        // implies node-jose stopped shortcircuiting correctly.
        .then((k) => assert.equal(k, key)));

    it('attempts to retrieve the specified key from the local cache', () =>
      otherWebex.internal.encryption
        .getKey(key.uri)
        .then((k) => assert.calledWith(storageGetSpy, k.uri)));

    it('fetches the key from the kms', () =>
      otherWebex.internal.encryption.unboundedStorage
        .del(key.uri)
        .then(() => assert.notCalled(fetchKeySpy))
        .then(() => otherWebex.internal.encryption.getKey(key.uri))
        .then(() => assert.calledOnce(fetchKeySpy)));

    it('stores the newly retrieved key', () =>
      otherWebex.internal.encryption
        .getKey(key.uri)
        .then((k) => otherWebex.internal.encryption.unboundedStorage.get(k.uri))
        .then((str) => JSON.parse(str))
        .then((k2) => {
          assert.property(k2, 'jwk');
          assert.property(k2.jwk, 'k');
          assert.equal(key.jwk.kid, k2.jwk.kid);
        }));
  });

  describe('#download()', () => {
    it('downloads and decrypts an encrypted file', () =>
      webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr, cdata}) =>
          webex
            .request({
              method: 'POST',
              uri: makeLocalUrl('/files/upload'),
              body: cdata,
            })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});

              return webex.internal.encryption.encryptScr(key, scr);
            })
        )
        .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
        .then((scr) => webex.internal.encryption.download(scr))
        .then((f) =>
          file.isMatchingFile(f, FILE).then((result) => assert.deepEqual(result, true))
        ));

    it('downloads and decrypts an encrypted file with options param', () =>
      webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr, cdata}) =>
          webex
            .request({
              method: 'POST',
              uri: makeLocalUrl('/files/upload'),
              body: cdata,
            })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});

              return webex.internal.encryption.encryptScr(key, scr);
            })
        )
        .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
        .then((scr) => {
          const options = {
            params: {
              allow: 'none',
            },
          };

          return webex.internal.encryption.download(scr, options);
        })
        .then((f) => file.isMatchingFile(f, FILE))
        .then((result) => assert.deepEqual(result, true)));

    it('emits progress events', () => {
      const spy = sinon.spy();

      return webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr, cdata}) =>
          webex
            .request({
              method: 'POST',
              uri: makeLocalUrl('/files/upload'),
              body: cdata,
            })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});

              return webex.internal.encryption.encryptScr(key, scr);
            })
        )
        .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
        .then((scr) => webex.internal.encryption.download(scr).on('progress', spy))
        .then(() => assert.called(spy));
    });

    it('checks body of the API call /downloads/endpoints', () =>
      webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr, cdata}) =>
          webex
            .request({
              method: 'POST',
              uri: makeLocalUrl('/files/upload'),
              body: cdata,
            })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});

              return webex.internal.encryption.encryptScr(key, scr);
            })
        )
        .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
        .then((scr) => {
          const options = {
            params: {
              allow: ['unchecked', 'evaluating'],
            },
          };

          return webex.internal.encryption.download(scr, options);
        })
        .then((f) => file.isMatchingFile(f, FILE))
        .then((result) => assert.deepEqual(result, true)));

    it('checks _fetchDownloadUrl()', () =>
      webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr, cdata}) =>
          webex
            .request({
              method: 'POST',
              uri: makeLocalUrl('/files/upload'),
              body: cdata,
            })
            .then((res) => {
              scr.loc = makeLocalUrl(res.body.loc, {full: true});

              return webex.internal.encryption.encryptScr(key, scr);
            })
        )
        .then((cipherScr) => webex.internal.encryption.decryptScr(key, cipherScr))
        .then((scr) => {
          const options = {
            params: {
              allow: ['unchecked', 'evaluating'],
            },
          };

          return webex.internal.encryption._fetchDownloadUrl(scr, options);
        })
        .then((result) => assert.isString(result)));
  });

  describe('#encryptBinary()', () => {
    it('encrypts a binary file', () =>
      webex.internal.encryption.encryptBinary(FILE).then(({scr, cdata}) => {
        assert.property(scr, 'enc');
        assert.property(scr, 'key');
        assert.property(scr, 'iv');

        return assert.isBufferLike(cdata);
      }));

    // browserOnly(it)(`accepts an ArrayBuffer`);
    // browserOnly(it)(`accepts a Blob`);
  });

  describe('#encryptScr()', () => {
    it('encrypts an scr', () =>
      webex.internal.encryption
        .encryptBinary(FILE)
        .then(({scr}) => {
          scr.loc = 'file:///file.enc';

          return webex.internal.encryption.encryptScr(key, scr);
        })
        .then((cipherScr) => assert.isString(cipherScr)));
  });

  describe('#encryptText()', () => {
    it('encrypts text', () =>
      webex.internal.encryption
        .encryptText(key, PLAINTEXT)
        .then((ciphertext) => assert.notEqual(ciphertext, PLAINTEXT)));
  });

  describe('#onBehalfOf', () => {
    let complianceUser;

    before('create compliance officer test user', () =>
      testUsers
        .create({
          count: 1,
          config: {
            roles: [{name: 'spark.kms_orgagent'}],
          },
        })
        .then((users) => {
          complianceUser = users[0];
          complianceUser.webex = new WebexCore({
            credentials: {
              authorization: complianceUser.token,
            },
          });
          assert.isTrue(complianceUser.webex.canAuthorize);
        })
    );

    after(() => complianceUser && complianceUser.webex.internal.mercury.disconnect());

    it('decrypt text', () =>
      webex.internal.encryption
        .encryptText(key, PLAINTEXT)
        .then((ciphertext) => {
          assert.notEqual(ciphertext, PLAINTEXT);

          return complianceUser.webex.internal.encryption.decryptText(key, ciphertext, {
            onBehalfOf: user.id,
          });
        })
        .then((plaintext) => assert.equal(plaintext, PLAINTEXT)));

    it('encrypt and decrypt text', () =>
      complianceUser.webex.internal.encryption
        .encryptText(key, PLAINTEXT, {onBehalfOf: user.id})
        .then((ciphertext) => {
          assert.notEqual(ciphertext, PLAINTEXT);

          return complianceUser.webex.internal.encryption.decryptText(key, ciphertext, {
            onBehalfOf: user.id,
          });
        })
        .then((plaintext) => assert.equal(plaintext, PLAINTEXT)));

    it('decrypt scr', () =>
      webex.internal.encryption.encryptBinary(FILE).then(({scr}) => {
        scr.loc = 'file:///file.enc';

        return webex.internal.encryption
          .encryptScr(key, scr)
          .then((cipherScr) =>
            complianceUser.webex.internal.encryption.decryptScr(key, cipherScr, {
              onBehalfOf: user.id,
            })
          )
          .then((decryptedScr) => assert.deepEqual(decryptedScr, scr));
      }));

    it('decrypt scr', () =>
      webex.internal.encryption.encryptBinary(FILE).then(({scr}) => {
        scr.loc = 'file:///file.enc';

        return complianceUser.webex.internal.encryption
          .encryptScr(key, scr, {onBehalfOf: user.id})
          .then((cipherScr) =>
            complianceUser.webex.internal.encryption.decryptScr(key, cipherScr, {
              onBehalfOf: user.id,
            })
          )
          .then((decryptedScr) => assert.deepEqual(decryptedScr, scr));
      }));

    it('getKey', () =>
      complianceUser.webex.internal.encryption
        .getKey(key.uri, {onBehalfOf: user.id})
        .then((key2) => {
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        }));

    it('getKey forbidden as compliance officer does not have access', () =>
      complianceUser.webex.internal.encryption.getKey(key.uri).then(
        (value) => expect.fail(`Compliance officer has retrieved key without onBehalfOf: ${value}`),
        (error) => expect(error.body.status).to.equal(403)
      ));

    it('getKey forbidden as user does not have access', () =>
      complianceUser.webex.internal.encryption
        .getKey(key.uri, {onBehalfOf: '7851fe79-7c87-40cc-ac36-8b77b011b399'})
        .then(
          (value) =>
            expect.fail(
              `Should not be found as 7851fe79-7c87-40cc-ac36-8b77b011b399 does not have access ${value}`
            ),
          (error) => expect(error.body.status).to.equal(403)
        ));

    it('getKey onBehalfOf and then by compliance officer only', () =>
      complianceUser.webex.internal.encryption
        .getKey(key.uri, {onBehalfOf: user.id})
        .then((key2) => {
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        })
        .then(() => complianceUser.webex.internal.encryption.getKey(key.uri))
        .then(
          (value) =>
            expect.fail(
              `Compliance should no longer be able to retrieve key as onBehalfOf was not set: ${value}`
            ),
          (error) => expect(error.body.status).to.equal(403)
        ));
  });
});
