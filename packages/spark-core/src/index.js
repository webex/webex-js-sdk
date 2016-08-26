/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import './plugins/logger';
import './plugins/credentials';

export {
  makeSparkStore,
  makeSparkPluginStore,
  MemoryStoreAdapter,
  NotFoundError,
  StorageError
} from './lib/storage';

export {
  children,
  default as default,
  SparkHttpError,
  SparkPlugin,
  AuthInterceptor,
  NetworkTimingInterceptor,
  registerPlugin,
  RedirectInterceptor,
  ResponseLoggerInterceptor,
  RequestLoggerInterceptor,
  RequestTimingInterceptor,
  SparkTrackingIdInterceptor
} from './spark-core';

export {
  Authorization,
  default as Credentials,
  grantErrors
} from './plugins/credentials';

export {
  SparkPluginStorage,
  Store,
  MemoryStoreAdapter,
  persist,
  waitForValue
} from './lib/storage';

export {default as Batcher} from './lib/batcher';
