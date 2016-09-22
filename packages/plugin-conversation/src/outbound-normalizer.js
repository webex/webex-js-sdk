/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Normalizer from './normalizer';
import {filter as htmlFilter} from '@ciscospark/helper-html';

const OutboundNormalizer = Normalizer.extend({
  filter(html) {
    return htmlFilter(this.config.outboundProcessFunc, this.config.allowedOutboundTags || {}, this.config.allowedOutboundStyles, html);
  }
});

export default OutboundNormalizer;
