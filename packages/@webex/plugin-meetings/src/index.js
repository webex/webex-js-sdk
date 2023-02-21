/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Meetings from './meetings';
import * as Meeting from './meeting';
import config from './config';

import * as CONSTANTS from './constants';
import * as REACTIONS from './reactions/reactions';

registerPlugin('meetings', Meetings, {
  config,
});

export default Meetings;

export {CONSTANTS, REACTIONS, Meeting};

export {default as TriggerProxy} from './common/events/trigger-proxy';
