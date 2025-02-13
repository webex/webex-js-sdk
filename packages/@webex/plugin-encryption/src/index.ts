/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Cypher from './cypher';
import config from './config';

registerPlugin('cypher', Cypher, {
  config,
});

export default Cypher;
