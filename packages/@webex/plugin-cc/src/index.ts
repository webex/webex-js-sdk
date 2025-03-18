import {registerPlugin} from '@webex/webex-core';

import config from './config';
import ContactCenter from './cc';

registerPlugin('cc', ContactCenter, {
  config,
});

export default ContactCenter;
