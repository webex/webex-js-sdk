/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import HttpStatusInterceptor from '@webex/http-core/src/interceptors/http-status';

import AuthInterceptor from '../interceptors/auth';
import NetworkTimingInterceptor from '../interceptors/network-timing';
import PayloadTransformerInterceptor from '../interceptors/payload-transformer';
import RedirectInterceptor from '../interceptors/redirect';
import RequestEventInterceptor from '../interceptors/request-event';
import RequestLoggerInterceptor from '../interceptors/request-logger';
import RequestTimingInterceptor from '../interceptors/request-timing';
import ResponseLoggerInterceptor from '../interceptors/response-logger';
import UserAgentInterceptor from '../interceptors/user-agent';
import ProxyInterceptor from '../interceptors/proxy';
import WebexTrackingIdInterceptor from '../interceptors/webex-tracking-id';
import WebexUserAgentInterceptor from '../interceptors/webex-user-agent';
import RateLimitInterceptor from '../interceptors/rate-limit';
import EmbargoInterceptor from '../interceptors/embargo';
import DefaultOptionsInterceptor from '../interceptors/default-options';
import HostMapInterceptor from './interceptors/hostmap';
import WebexHttpError from './webex-http-error';

export const interceptors = {
  WebexTrackingIdInterceptor: WebexTrackingIdInterceptor.create,
  RequestEventInterceptor: RequestEventInterceptor.create,
  RateLimitInterceptor: RateLimitInterceptor.create,
  RequestLoggerInterceptor:
    process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING
      ? RequestLoggerInterceptor.create
      : undefined,
  ResponseLoggerInterceptor:
    process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING
      ? ResponseLoggerInterceptor.create
      : undefined,
  RequestTimingInterceptor: RequestTimingInterceptor.create,
  ServiceInterceptor: undefined,
  UserAgentInterceptor: UserAgentInterceptor.create,
  ProxyInterceptor: ProxyInterceptor.create,
  WebexUserAgentInterceptor: WebexUserAgentInterceptor.create,
  AuthInterceptor: AuthInterceptor.create,
  KmsDryErrorInterceptor: undefined,
  PayloadTransformerInterceptor: PayloadTransformerInterceptor.create,
  ConversationInterceptor: undefined,
  RedirectInterceptor: RedirectInterceptor.create,
  HttpStatusInterceptor() {
    return HttpStatusInterceptor.create({
      error: WebexHttpError,
    });
  },
  NetworkTimingInterceptor: NetworkTimingInterceptor.create,
  EmbargoInterceptor: EmbargoInterceptor.create,
  DefaultOptionsInterceptor: DefaultOptionsInterceptor.create,
  HostMapInterceptor: HostMapInterceptor.create,
};

export const preInterceptors = [
  'ResponseLoggerInterceptor',
  'RequestTimingInterceptor',
  'RequestEventInterceptor',
  'WebexTrackingIdInterceptor',
  'RateLimitInterceptor',
];

export const postInterceptors = [
  'HttpStatusInterceptor',
  'NetworkTimingInterceptor',
  'EmbargoInterceptor',
  'RequestLoggerInterceptor',
  'RateLimitInterceptor',
];
