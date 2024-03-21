/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {isNumber} from 'lodash';

/**
 * Object of the same shape as web browser ProgressEvents
 * @class ProgressEvent
 * @param {integer} loaded
 * @param {integer} total
 * @returns {ProgressEvent}
 */
export default function ProgressEvent(loaded, total) {
  Object.defineProperties(this, {
    loaded: {
      enumerable: true,
      value: loaded,
      writable: false,
    },
    total: {
      enumerable: true,
      value: total,
      writable: false,
    },
    lengthComputable: {
      enumerable: true,
      value:
        isNumber(loaded) &&
        !Number.isNaN(loaded) &&
        isNumber(total) &&
        !Number.isNaN(total) &&
        total > 0,
      writable: false,
    },
  });
}
