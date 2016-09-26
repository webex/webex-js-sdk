/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Normalizer from './normalizer';
import {filter as htmlFilter} from '@ciscospark/helper-html';

const InboundNormalizer = Normalizer.extend({
  filter(html) {
    return htmlFilter(this.config.inboundProcessFunc, this.config.allowedInboundTags || {}, this.config.allowedInboundStyles, html);
  }
});

export default InboundNormalizer;
