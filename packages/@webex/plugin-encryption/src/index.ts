/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Cypher from './cypher';
import config from './config';
import {FileDownloadOptions, IEncryption} from './cypher/types';

registerPlugin('cypher', Cypher, {
  config,
});

export default Cypher;
export type {FileDownloadOptions, IEncryption};
