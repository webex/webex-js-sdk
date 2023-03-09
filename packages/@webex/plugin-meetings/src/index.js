/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Meetings from './meetings';
import config from './config';

registerPlugin('meetings', Meetings, {
  config,
});

export default Meetings;

export * as CONSTANTS from './constants';
export * as REACTIONS from './reactions/reactions';

export {RemoteMedia} from './multistream/remoteMedia';

export {default as TriggerProxy} from './common/events/trigger-proxy';
