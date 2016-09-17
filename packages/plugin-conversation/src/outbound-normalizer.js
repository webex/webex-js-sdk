/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Normalizer from './normalizer';
import {filter} from '@ciscospark/helper-html';

const OutboundNormalizer = Normalizer.extend({
  derived: {
    filter: {
      deps: [],
      fn() {
        // eslint-disable-next-line no-empty-function
        return filter(this.config.outboundProcessFunc, this.config.allowedOutboundTags || {}, this.config.allowedOutboundStyles);
      }
    }
  }
});

export default OutboundNormalizer;
