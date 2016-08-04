/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import extendError from 'extend-error';

export const StorageError = extendError(Error, {
  subTypeName: `StorageError`
});

export const NotFoundError = extendError(StorageError, {
  subTypeName: `NotFoundError`
});
