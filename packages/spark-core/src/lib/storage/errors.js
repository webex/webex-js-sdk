/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import extendError from 'extend-error';

export const StorageError = extendError(Error, {
  subTypeName: `StorageError`
});

export const NotFoundError = extendError(StorageError, {
  subTypeName: `NotFoundError`
});
