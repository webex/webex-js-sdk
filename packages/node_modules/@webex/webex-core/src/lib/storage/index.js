/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

export {
  persist,
  waitForValue
} from './decorators';
export {default as makeSparkStore} from './make-spark-store.js';
export {default as makeSparkPluginStore} from './make-spark-plugin-store.js';
export {default as MemoryStoreAdapter} from './memory-store-adapter';
export {StorageError, NotFoundError} from './errors';
