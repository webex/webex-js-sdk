import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';
import {Buffer} from 'safe-buffer';
import '@webex/plugin-authorization';
import '@webex/internal-plugin-mercury';
import '@webex/plugin-logger';
import '@webex/internal-plugin-support';

import './index';

import config from './webex-config';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

Webex.init = function init(attrs = {}) {
  attrs.config = merge({}, config, attrs.config);

  return new Webex(attrs);
};

export default Webex;
