import {registerInternalPlugin} from '@webex/webex-core';

import DSS from './dss';

registerInternalPlugin('dss', DSS);

export {default} from './dss';
