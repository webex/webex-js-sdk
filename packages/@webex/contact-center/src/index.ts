import {registerPlugin} from '@webex/webex-core';

import ContactCenter from './contact-center';
import config from './config';

registerPlugin('cc', ContactCenter, {
  config,
});

export default ContactCenter;
