/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 *
 * Services is currently a part of webex-core due to how the contents of
 * the original internal-plugin-services needed to be accessed when webex-core
 * is initialized. As a plugin outside of webex-core, it would initialize after
 * credentials, causing all requests prior to its initialization to fail
 * federation requirements, and instead send requests to the environmentally-
 * assigned urls.
 */

import './plugins/logger';
import './lib/credentials';
import './lib/services';

export {
  Credentials,
  filterScope,
  grantErrors,
  sortScope,
  Token
} from './lib/credentials';

export {
  constants as serviceConstants,
  ServiceCatalog,
  ServiceRegistry,
  ServiceState,
  ServiceInterceptor,
  ServerErrorInterceptor,
  Services,
  ServiceHost,
  ServiceUrl
} from './lib/services';

export {
  makeWebexStore,
  makeWebexPluginStore,
  MemoryStoreAdapter,
  NotFoundError,
  persist,
  StorageError,
  waitForValue
} from './lib/storage';

export {
  default,
  registerPlugin,
  registerInternalPlugin
} from './webex-core';

export {default as WebexHttpError} from './lib/webex-http-error';
export {default as StatelessWebexPlugin} from './lib/stateless-webex-plugin';
export {default as WebexPlugin} from './lib/webex-plugin';
export {default as AuthInterceptor} from './interceptors/auth';
export {default as NetworkTimingInterceptor} from './interceptors/network-timing';
export {default as PayloadTransformerInterceptor} from './interceptors/payload-transformer';
export {default as RedirectInterceptor} from './interceptors/redirect';
export {default as ResponseLoggerInterceptor} from './interceptors/response-logger';
export {default as RequestEventInterceptor} from './interceptors/request-event';
export {default as RequestLoggerInterceptor} from './interceptors/request-logger';
export {default as RequestTimingInterceptor} from './interceptors/request-timing';
export {default as UserAgentInterceptor} from './interceptors/user-agent';
export {default as WebexTrackingIdInterceptor} from './interceptors/webex-tracking-id';
export {default as WebexUserAgentInterceptor} from './interceptors/webex-user-agent';
export {default as RateLimitInterceptor} from './interceptors/rate-limit';
export {default as EmbargoInterceptor} from './interceptors/embargo';
export {default as DefaultOptionsInterceptor} from './interceptors/default-options';

export {default as Batcher} from './lib/batcher';
export {default as Page} from './lib/page';
export {default as config} from './config';
