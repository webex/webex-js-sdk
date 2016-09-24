/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import AmpCollection from 'ampersand-collection';
import Token from './token';

const TokenCollection = AmpCollection.extend({
  mainIndex: `scope`,

  model: Token,

  namespace: `Credentials`
});

export default TokenCollection;
