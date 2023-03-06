/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Meetings from './meetings';
import config from './config';

import * as CONSTANTS from './constants';
import * as REACTIONS from './reactions/reactions';

registerPlugin('meetings', Meetings, {
  config,
});

export default Meetings;
export {default as Meeting} from './meeting';

export {CONSTANTS, REACTIONS};

export {default as TriggerProxy} from './common/events/trigger-proxy';
