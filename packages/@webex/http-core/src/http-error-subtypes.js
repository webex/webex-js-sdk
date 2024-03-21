/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @param {Error} Base
 * @returns {undefined}
 */
export default function makeSubTypes(Base) {
  /**
   * NetworkOrCORSError
   */
  class NetworkOrCORSError extends Base {}
  /**
   * BadRequest
   */
  class BadRequest extends Base {}
  /**
   * Unauthorized
   */
  class Unauthorized extends BadRequest {}
  /**
   * PaymentRequired
   */
  class PaymentRequired extends BadRequest {}
  /**
   * Forbidden
   */
  class Forbidden extends BadRequest {}
  /**
   * NotFound
   */
  class NotFound extends BadRequest {}
  /**
   * MethodNotAllowed
   */
  class MethodNotAllowed extends BadRequest {}
  /**
   * NotAcceptable
   */
  class NotAcceptable extends BadRequest {}
  /**
   * ProxyAuthenticationRequired
   */
  class ProxyAuthenticationRequired extends BadRequest {}
  /**
   * RequestTimeout
   */
  class RequestTimeout extends BadRequest {}
  /**
   * Conflict
   */
  class Conflict extends BadRequest {}
  /**
   * Gone
   */
  class Gone extends BadRequest {}
  /**
   * LengthRequired
   */
  class LengthRequired extends BadRequest {}
  /**
   * PreconditionFailed
   */
  class PreconditionFailed extends BadRequest {}
  /**
   * RequestEntityTooLarge
   */
  class RequestEntityTooLarge extends BadRequest {}
  /**
   * RequestUriTooLong
   */
  class RequestUriTooLong extends BadRequest {}
  /**
   * UnsupportedMediaType
   */
  class UnsupportedMediaType extends BadRequest {}
  /**
   * RequestRangeNotSatisfiable
   */
  class RequestRangeNotSatisfiable extends BadRequest {}
  /**
   * ExpectationFailed
   */
  class ExpectationFailed extends BadRequest {}
  /**
   * TooManyRequests
   */
  class TooManyRequests extends BadRequest {}
  /**
   * InternalServerError
   */
  class InternalServerError extends Base {}
  /**
   * NotImplemented
   */
  class NotImplemented extends InternalServerError {}
  /**
   * BadGateway
   */
  class BadGateway extends InternalServerError {}
  /**
   * ServiceUnavailable
   */
  class ServiceUnavailable extends InternalServerError {}
  /**
   * GatewayTimeout
   */
  class GatewayTimeout extends InternalServerError {}
  /**
   * HttpVersionNotSupported
   */
  class HttpVersionNotSupported extends InternalServerError {}

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
    429: TooManyRequests,
    TooManyRequests,
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
      if (typeof statusCode === 'undefined' || statusCode === null) {
        return Base;
      }

      statusCode = statusCode.statusCode || statusCode;
      const E = Base[statusCode];

      if (E) {
        return E;
      }

      // Fallback to the default for the category (e.g. BadRequest for 429)
      statusCode = `${statusCode.toString().split('').shift()}00`;
      statusCode = parseInt(statusCode, 10);

      return Base[statusCode] || Base;
    },
  });
}
