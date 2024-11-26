/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Cypher from './encryption';
import config from './config';

registerPlugin('cypher', Cypher, {
  config,
  interceptors: {},
});

export default Cypher;
