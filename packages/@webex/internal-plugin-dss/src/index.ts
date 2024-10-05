import {registerInternalPlugin} from '@webex/webex-core';

import DSS from './dss';
import config from './config';

registerInternalPlugin('dss', DSS, {config});

export {default} from './dss';
