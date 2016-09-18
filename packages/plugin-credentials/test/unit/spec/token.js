/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';

describe(`plugin-credentials`, () => {
  describe(`Token`, () => {
    describe(`#canAuthorize`, () => {
      // access_token and isExpired
      it(`indicates if this token can be used to authorize a request`);
    });

    describe(`#canDownscope`, () => {
      // canAuthorize
      // Consider storing the token's scopes along with the token, thus allowing
      // this attribute to be more specific
      it(`indicates if this token can be used to get a token of lesser scope`);
    });

    describe(`#canRefresh`, () => {
      // refresh_token and refresh_token_expires
      it(`indicates if this token can be refreshed`);
    });

    describe(`#isExpired`, () => {
      it(`derives from \`expires\``);
    });

    describe(`#isUseless`, () => {
      // canAuthorize and canDownscope and canRefresh
      it(`indicates if this token can do anything`);
    });

    describe(`#string`, () => {
      it(`derives from \`access_token\` and \`token_type\``);
    });

    describe(`#downscope()`, () => {
      it(`requires an access token`);
      it(`requires an unexpired access token`);
      it(`alphabetizes the requested scope`);
    });

    describe(`#initialize()`, () => {
      it(`requires an access token`);
      it(`computes expires_in and refresh_token_expires_in if not specified`);
      it(`alphabetizes the token's scopes`);
    });

    describe(`#refresh()`, () => {
      it(`refreshes the access token`);
      it(`revokes the previous token when set`);
    });

    describe(`#revoke()`, () => {
      describe(`when the token is expired`, () => {
        it(`is a noop`);
      });

      describe(`when the access token has been unset`, () => {
        it(`is a noop`);
      });

      it(`unsets the access_token and related values`);
    });

    describe(`#toString()`, () => {
      it(`returns a set of values usable in an auth header`);
    });
  });
});
