/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import extendError from 'extend-error';

const OAuthError = extendError({
  parseFn: function parseFn(res) {
    Object.defineProperties(this, {
      error: {
        enumerable: true,
        value: res.body.error
      },
      errorDescription: {
        enumerable: true,
        value: res.body.error_description
      },
      errorUri: {
        enumerable: true,
        value: res.body.error_uri
      },
      res: {
        enumerable: false,
        value: res
      }
    });

    return this.errorDescription;
  },
  subTypeName: `OAuthError`
});

const InvalidRequestError = extendError(OAuthError, `InvalidRequestError`);
const InvalidClientError = extendError(OAuthError, `InvalidClientError`);
const InvalidGrantError = extendError(OAuthError, `InvalidGrantError`);
const UnauthorizedClientError = extendError(OAuthError, `UnauthorizedClientError`);
const UnsupportGrantTypeError = extendError(OAuthError, `UnsupportGrantTypeError`);
const InvalidScopeError = extendError(OAuthError, `InvalidScopeError`);

const errors = {
  OAuthError,
  InvalidRequestError,
  InvalidClientError,
  InvalidGrantError,
  UnauthorizedClientError,
  UnsupportGrantTypeError,
  InvalidScopeError,
  invalid_request: InvalidRequestError,
  invalid_client: InvalidClientError,
  invalid_grant: InvalidGrantError,
  unauthorized_client: UnauthorizedClientError,
  unsupported_grant_type: UnsupportGrantTypeError,
  invalid_scope: InvalidScopeError,
  select(errorString) {
    return errors[errorString] || OAuthError;
  }
};

export default errors;
