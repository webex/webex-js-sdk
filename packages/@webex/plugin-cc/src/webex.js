import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';
import '@webex/plugin-authorization';
import '@webex/internal-plugin-mercury';
import '@webex/plugin-logger';
import '@webex/internal-plugin-support';
import '@webex/plugin-cc';

import config from './webex-config';

const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

Webex.init = function init(attrs = {}) {
  attrs.config = merge({sdkType: 'contact-center'}, config, attrs.config);

  return new Webex(attrs);
};

export default Webex;
