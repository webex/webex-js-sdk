/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var extendError = require('extend-error');
var SparkHttpError = require('./spark-http-error');

var NetworkOrCORSError = extendError(SparkHttpError, {
  subTypeName: 'NetworkOrCORSError',
  code: 0
});

var BadRequest = extendError(SparkHttpError, {
  subTypeName: 'BadRequest',
  code: 400
});

var Unauthorized = extendError(BadRequest, {
  subTypeName: 'Unauthorized',
  code: 401
});

var PaymentRequired = extendError(BadRequest, {
  subTypeName: 'PaymentRequired',
  code: 402
});

var Forbidden = extendError(BadRequest, {
  subTypeName: 'Forbidden',
  code: 403
});

var NotFound = extendError(BadRequest, {
  subTypeName: 'NotFound',
  code: 404
});

var MethodNotAllowed = extendError(BadRequest, {
  subTypeName: 'MethodNotAllowed',
  code: 405
});

var NotAcceptable = extendError(BadRequest, {
  subTypeName: 'NotAcceptable',
  code: 406
});

var ProxyAuthenticationRequired = extendError(BadRequest, {
  subTypeName: 'ProxyAuthenticationRequired',
  code: 407
});

var RequestTimeout = extendError(BadRequest, {
  subTypeName: 'RequestTimeout',
  code: 408
});

var Conflict = extendError(BadRequest, {
  subTypeName: 'Conflict',
  code: 409
});

var Gone = extendError(BadRequest, {
  subTypeName: 'Gone',
  code: 410
});

var LengthRequired = extendError(BadRequest, {
  subTypeName: 'LengthRequired',
  code: 411
});

var PreconditionFailed = extendError(BadRequest, {
  subTypeName: 'PreconditionFailed',
  code: 412
});

var RequestEntityTooLarge = extendError(BadRequest, {
  subTypeName: 'RequestEntityTooLarge',
  code: 413
});

var RequestUriTooLong = extendError(BadRequest, {
  subTypeName: 'RequestUriTooLong',
  code: 414
});

var UnsupportedMediaType = extendError(BadRequest, {
  subTypeName: 'UnsupportedMediaType',
  code: 415
});

var RequestRangeNotSatisfiable = extendError(BadRequest, {
  subTypeName: 'RequestRangeNotSatisfiable',
  code: 416
});

var ExpectationFailed = extendError(BadRequest, {
  subTypeName: 'ExpectationFailed',
  code: 417
});

var InternalServerError = extendError(SparkHttpError, {
  subTypeName: 'InternalServerError',
  code: 500
});

var NotImplemented = extendError(InternalServerError, {
  subTypeName: 'NotImplemented',
  code: 501
});

var BadGateway = extendError(InternalServerError, {
  subTypeName: 'BadGateway',
  code: 502
});

var ServiceUnavailable = extendError(InternalServerError, {
  subTypeName: 'ServiceUnavailable',
  code: 503
});

var GatewayTimeout = extendError(InternalServerError, {
  subTypeName: 'GatewayTimeout',
  code: 504
});

var HttpVersionNotSupported = extendError(InternalServerError, {
  subTypeName: 'HttpVersionNotSupported',
  code: 505
});


module.exports = {
  0: NetworkOrCORSError,
  NetworkOrCORSError: NetworkOrCORSError,
  400: BadRequest,
  BadRequest: BadRequest,
  401: Unauthorized,
  Unauthorized: Unauthorized,
  402: PaymentRequired,
  PaymentRequired: PaymentRequired,
  403: Forbidden,
  Forbidden: Forbidden,
  404: NotFound,
  NotFound: NotFound,
  405: MethodNotAllowed,
  MethodNotAllowed: MethodNotAllowed,
  406: NotAcceptable,
  NotAcceptable: NotAcceptable,
  407: ProxyAuthenticationRequired,
  ProxyAuthenticationRequired: ProxyAuthenticationRequired,
  408: RequestTimeout,
  RequestTimeout: RequestTimeout,
  409: Conflict,
  Conflict: Conflict,
  410: Gone,
  Gone: Gone,
  411: LengthRequired,
  LengthRequired: LengthRequired,
  412: PreconditionFailed,
  PreconditionFailed: PreconditionFailed,
  413: RequestEntityTooLarge,
  RequestEntityTooLarge: RequestEntityTooLarge,
  414: RequestUriTooLong,
  RequestUriTooLong: RequestUriTooLong,
  415: UnsupportedMediaType,
  UnsupportedMediaType: UnsupportedMediaType,
  416: RequestRangeNotSatisfiable,
  RequestRangeNotSatisfiable: RequestRangeNotSatisfiable,
  417: ExpectationFailed,
  ExpectationFailed: ExpectationFailed,
  500: InternalServerError,
  InternalServerError: InternalServerError,
  501: NotImplemented,
  NotImplemented: NotImplemented,
  502: BadGateway,
  BadGateway: BadGateway,
  503: ServiceUnavailable,
  ServiceUnavailable: ServiceUnavailable,
  504: GatewayTimeout,
  GatewayTimeout: GatewayTimeout,
  505: HttpVersionNotSupported,
  HttpVersionNotSupported: HttpVersionNotSupported,
  select: function select(statusCode) {
    return module.exports[statusCode] || SparkHttpError;
  }
};
