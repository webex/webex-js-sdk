/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint camelcase: [0] */

var extendError = require('extend-error');

var OAuthError = extendError({
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
  subTypeName: 'OAuthError'
});

var InvalidRequestError = extendError(OAuthError, 'InvalidRequestError');
var InvalidClientError = extendError(OAuthError, 'InvalidClientError');
var InvalidGrantError = extendError(OAuthError, 'InvalidGrantError');
var UnauthorizedClientError = extendError(OAuthError, 'UnauthorizedClientError');
var UnsupportGrantTypeError = extendError(OAuthError, 'UnsupportGrantTypeError');
var InvalidScopeError = extendError(OAuthError, 'InvalidScopeError');

module.exports = {
  OAuthError: OAuthError,
  invalid_request: InvalidRequestError,
  InvalidRequestError: InvalidRequestError,
  invalid_client: InvalidClientError,
  InvalidClientError: InvalidClientError,
  invalid_grant: InvalidGrantError,
  InvalidGrantError: InvalidGrantError,
  unauthorized_client: UnauthorizedClientError,
  UnauthorizedClientError: UnauthorizedClientError,
  unsupported_grant_type: UnsupportGrantTypeError,
  UnsupportGrantTypeError: UnsupportGrantTypeError,
  invalid_scope: InvalidScopeError,
  InvalidScopeError: InvalidScopeError,
  select: function select(errorString) {
    return module.exports[errorString] || OAuthError;
  }
};
