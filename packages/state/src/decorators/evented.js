/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Events from 'ampersand-events';

export default function evented(target) {
  Object.assign(target.prototype, Events);
}
