/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Normalizer from './normalizer';
import {filter} from '@ciscospark/helper-html';

const InboundNormalizer = Normalizer.extend({
  derived: {
    filter: {
      deps: [],
      fn() {
        return filter(this.config.inboundProcessFunc, this.config.allowedInboundTags || {}, this.config.allowedInboundStyles);
      }
    }
  }
});

export default InboundNormalizer;
