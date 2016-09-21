/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {Token} from '../..';
import lolex from 'lolex';

/* eslint camelcase: [0] */

describe(`plugin-credentials`, () => {
  describe(`Token`, () => {
    let spark, token;
    beforeEach(() => {
      spark = new MockSpark();
      token = new Token({
        access_token: `AT`,
        expires_in: 10000,
        token_type: `Fake`,
        refresh_token: `RT`,
        refresh_token_expires: 20000
      }, {parent: spark});
    });

    describe(`#canAuthorize`, () => {
      it(`indicates if this token can be used to authorize a request`, () => {
        assert.isTrue(token.canAuthorize);

        token.expires = Date.now() - 10000;
        assert.isFalse(token.canAuthorize);

        token.expires = Date.now() + 10000;
        assert.isTrue(token.canAuthorize);

        token.unset(`expires`);
        assert.isTrue(token.canAuthorize);

        token.unset(`access_token`);
        assert.isFalse(token.canAuthorize);
      });
    });

    describe(`#canDownscope`, () => {
      it(`indicates if this token can be used to get a token of lesser scope`, () => {
        assert.isTrue(token.canDownscope);

        token.expires = Date.now() - 10000;
        assert.isFalse(token.canDownscope);

        token.expires = Date.now() + 10000;
        assert.isTrue(token.canDownscope);

        token.unset(`expires`);
        assert.isTrue(token.canDownscope);

        token.unset(`access_token`);
        assert.isFalse(token.canDownscope);
      });
    });

    describe(`#canRefresh`, () => {
      it(`indicates if this token can be refreshed`, () => {
        assert.isTrue(token.canRefresh);
        token.unset(`refresh_token`);
        assert.isFalse(token.canRefresh);
      });
    });

    describe(`#isExpired`, () => {
      it(`derives from \`expires\``, () => {
        assert.isFalse(token.isExpired);

        token.expires = Date.now() - 10000;
        assert.isTrue(token.isExpired);

        token.expires = Date.now() + 10000;
        assert.isFalse(token.isExpired);
      });
    });

    describe(`#string`, () => {
      it(`derives from \`access_token\` and \`token_type\``, () => {
        assert.equal(token.string, `Fake AT`);

        token.token_type = `Fake`;
        token.unset(`access_token`);
        assert.equal(token.string, ``);
      });
    });

    describe(`#downscope()`, () => {
      it(`requires an access token`, () => {
        token.unset(`access_token`);
        return assert.isRejected(token.downscope(`spark:kms`), /cannot downscope access token/);
      });

      it(`requires an unexpired access token`, () => {
        token.expires = Date.now() - 10000;
        return assert.isRejected(token.downscope(`spark:kms`), /cannot downscope expired access token/);
      });

      it(`alphabetizes the requested scope`, () => {
        spark.request.returns(Promise.resolve({body: {access_token: `AT2`}}));

        return assert.isFulfilled(token.downscope(`b a`))
          .then(() => assert.equal(spark.request.args[0][0].form.scope, `a b`));
      });
    });

    describe(`#initialize()`, () => {
      let clock;
      beforeEach(() => {
        clock = lolex.install();
      });
      afterEach(() => clock.uninstall());

      it(`requires an access token`, () => {
        assert.throws(() => {
          // eslint-disable-next-line no-unused-vars
          const x = new Token();
        }, /`access_token` is required/);

        assert.doesNotThrow(() => {
          // eslint-disable-next-line no-unused-vars
          const x = new Token({access_token: `AT`});
        }, /`access_token` is required/);
      });

      it(`infers token_type from an access token string`, () => {
        const t = new Token({
          access_token: `Fake AT`
        });
        assert.equal(t.access_token, `AT`);
        assert.equal(t.token_type, `Fake`);
      });

      it(`computes expires_in and refresh_token_expires_in if not specified`, () => {
        clock.setSystemTime(0);

        const t = new Token({
          access_token: `AT`,
          expires_in: 6000,
          refresh_token: `RT`,
          refresh_token_expires_in: 12000
        }, {parent: spark});

        assert.equal(t.expires, 6000000);
        assert.equal(t.refresh_token_expires, 12000000);
      });

      it(`alphabetizes the token's scopes`, () => {
        const t = new Token({
          access_token: `AT`,
          scope: `b a`
        });
        assert.equal(t.scope, `a b`);
      });
    });

    describe(`#refresh()`, () => {
      it(`refreshes the access token`, () => {
        spark.request.returns(Promise.resolve({
          statusCode: 200,
          body: {
            access_token: `AT2`,
            expires_in: 10000,
            token_type: `Fake`
          }
        }));

        return token.refresh()
          .then((t) => {
            assert.equal(t.access_token, `AT2`);
            assert.equal(t.refresh_token, token.refresh_token);
          });
      });

      it(`revokes the previous token when set`, () => {
        spark.request.returns(Promise.resolve({
          statusCode: 200,
          body: {
            access_token: `AT2`,
            expires_in: 10000,
            token_type: `Fake`
          }
        }));

        token.previousToken = new Token({
          access_token: `ATP`,
          expires_in: 10000,
          token_type: `Fake`
        }, {parent: spark});

        return token.refresh()
          .then((t) => {
            assert.equal(t.access_token, `AT2`);
            assert.equal(t.refresh_token, token.refresh_token);
            assert.equal(spark.request.args[1][0].resource, `/revoke`);
          });
      });
    });

    describe(`#revoke()`, () => {
      beforeEach(() => {
        spark.request.returns(Promise.resolve({
          statusCode: 200,
          body: {}
        }));
      });

      describe(`when the token is expired`, () => {
        beforeEach(() => {
          token.expires = Date.now() - 10000;
        });

        it(`is a noop`, () => token.revoke()
          .then(() => assert.notCalled(spark.request)));
      });

      describe(`when the access token has been unset`, () => {
        beforeEach(() => {
          token.unset(`access_token`);
        });

        it(`is a noop`, () => token.revoke()
          .then(() => assert.notCalled(spark.request)));
      });

      it(`unsets the access_token and related values`, () => {
        return token.revoke()
          .then(() => {
            assert.isUndefined(token.access_token);
            assert.isUndefined(token.expires);
            assert.isUndefined(token.expires_in);
          });
      });
    });

    describe(`#toString()`, () => {
      it(`returns a set of values usable in an auth header`, () => {
        assert.equal(token.toString(), `Fake AT`);

        token.unset(`access_token`);

        assert.throws(() => {
          token.toString();
        }, /cannot stringify Token/);
      });
    });
  });
});
