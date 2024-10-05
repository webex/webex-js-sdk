require('@webex/plugin-authorization');
require('@webex/contact-center');

import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';
  
import config from './config';
  
const Webex = WebexCore.extend({
    webex: true,
    version: PACKAGE_VERSION,
});
  
Webex.init = function init(attrs = {}) {
    attrs.config = merge(
        {},
        config,
        attrs.config
    ); // eslint-disable-line no-param-reassign
    
    return new Webex(attrs);
};

module.exports = Webex;