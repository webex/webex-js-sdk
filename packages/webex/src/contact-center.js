import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';

require('@webex/plugin-authorization');
require('@webex/plugin-cc');
require('@webex/internal-plugin-mercury');

const config = require('./config');

const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

Webex.init = function init(attrs = {}) {
  attrs.config = merge({}, config, attrs.config); // eslint-disable-line no-param-reassign

  return new Webex(attrs);
};

export default Webex;
