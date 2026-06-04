/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Uses Promise#then to run some number of ticks
 * @param count
 */
export default function promiseTick(count: number): Promise<void> {
  let promise = Promise.resolve<void>(undefined);

  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }

  return promise;
}
