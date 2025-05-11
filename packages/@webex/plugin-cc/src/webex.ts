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
});

Webex.init = function init(attrs = {} as any) {
  attrs.config = merge({}, config, attrs.config); // eslint-disable-line no-param-reassign

  return new Webex(attrs);
};

export default Webex;
