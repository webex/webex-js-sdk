/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import extendError from 'extend-error';

/**
 * @param {Error} Base
 * @returns {undefined}
 */
export default function makeSubTypes(Base) {
  const NetworkOrCORSError = extendError(Base, {
    subTypeName: `NetworkOrCORSError`,
    code: 0
  });

  const BadRequest = extendError(Base, {
    subTypeName: `BadRequest`,
    code: 400
  });

  const Unauthorized = extendError(BadRequest, {
    subTypeName: `Unauthorized`,
    code: 401
  });

  const PaymentRequired = extendError(BadRequest, {
    subTypeName: `PaymentRequired`,
    code: 402
  });

  const Forbidden = extendError(BadRequest, {
    subTypeName: `Forbidden`,
    code: 403
  });

  const NotFound = extendError(BadRequest, {
    subTypeName: `NotFound`,
    code: 404
  });

  const MethodNotAllowed = extendError(BadRequest, {
    subTypeName: `MethodNotAllowed`,
    code: 405
  });

  const NotAcceptable = extendError(BadRequest, {
    subTypeName: `NotAcceptable`,
    code: 406
  });

  const ProxyAuthenticationRequired = extendError(BadRequest, {
    subTypeName: `ProxyAuthenticationRequired`,
    code: 407
  });

  const RequestTimeout = extendError(BadRequest, {
    subTypeName: `RequestTimeout`,
    code: 408
  });

  const Conflict = extendError(BadRequest, {
    subTypeName: `Conflict`,
    code: 409
  });

  const Gone = extendError(BadRequest, {
    subTypeName: `Gone`,
    code: 410
  });

  const LengthRequired = extendError(BadRequest, {
    subTypeName: `LengthRequired`,
    code: 411
  });

  const PreconditionFailed = extendError(BadRequest, {
    subTypeName: `PreconditionFailed`,
    code: 412
  });

  const RequestEntityTooLarge = extendError(BadRequest, {
    subTypeName: `RequestEntityTooLarge`,
    code: 413
  });

  const RequestUriTooLong = extendError(BadRequest, {
    subTypeName: `RequestUriTooLong`,
    code: 414
  });

  const UnsupportedMediaType = extendError(BadRequest, {
    subTypeName: `UnsupportedMediaType`,
    code: 415
  });

  const RequestRangeNotSatisfiable = extendError(BadRequest, {
    subTypeName: `RequestRangeNotSatisfiable`,
    code: 416
  });

  const ExpectationFailed = extendError(BadRequest, {
    subTypeName: `ExpectationFailed`,
    code: 417
  });

  const InternalServerError = extendError(Base, {
    subTypeName: `InternalServerError`,
    code: 500
  });

  const NotImplemented = extendError(InternalServerError, {
    subTypeName: `NotImplemented`,
    code: 501
  });

  const BadGateway = extendError(InternalServerError, {
    subTypeName: `BadGateway`,
    code: 502
  });

  const ServiceUnavailable = extendError(InternalServerError, {
    subTypeName: `ServiceUnavailable`,
    code: 503
  });

  const GatewayTimeout = extendError(InternalServerError, {
    subTypeName: `GatewayTimeout`,
    code: 504
  });

  const HttpVersionNotSupported = extendError(InternalServerError, {
    subTypeName: `HttpVersionNotSupported`,
    code: 505
  });

  Object.assign(Base, {
    0: NetworkOrCORSError,
    NetworkOrCORSError,
    400: BadRequest,
    BadRequest,
    401: Unauthorized,
    Unauthorized,
    402: PaymentRequired,
    PaymentRequired,
    403: Forbidden,
    Forbidden,
    404: NotFound,
    NotFound,
    405: MethodNotAllowed,
    MethodNotAllowed,
    406: NotAcceptable,
    NotAcceptable,
    407: ProxyAuthenticationRequired,
    ProxyAuthenticationRequired,
    408: RequestTimeout,
    RequestTimeout,
    409: Conflict,
    Conflict,
    410: Gone,
    Gone,
    411: LengthRequired,
    LengthRequired,
    412: PreconditionFailed,
    PreconditionFailed,
    413: RequestEntityTooLarge,
    RequestEntityTooLarge,
    414: RequestUriTooLong,
    RequestUriTooLong,
    415: UnsupportedMediaType,
    UnsupportedMediaType,
    416: RequestRangeNotSatisfiable,
    RequestRangeNotSatisfiable,
    417: ExpectationFailed,
    ExpectationFailed,
    500: InternalServerError,
    InternalServerError,
    501: NotImplemented,
    NotImplemented,
    502: BadGateway,
    BadGateway,
    503: ServiceUnavailable,
    ServiceUnavailable,
    504: GatewayTimeout,
    GatewayTimeout,
    505: HttpVersionNotSupported,
    HttpVersionNotSupported,
    select(statusCode) {
      if (typeof statusCode === `undefined` || statusCode === null) {
        return Base;
      }

      statusCode = statusCode.statusCode || statusCode;
      const E = Base[statusCode];
      if (E) {
        return E;
      }

      // Fallback to the default for the category (e.g. BadRequest for 429)
      statusCode = `${statusCode.toString().split(``).shift()}00`;
      statusCode = parseInt(statusCode, 10);

      return Base[statusCode] || Base;
    }
  });
}
