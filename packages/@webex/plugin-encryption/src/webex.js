/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See the LICENSE file.
 */

import '@babel/polyfill';

import '@webex/plugin-authorization';
import '@webex/internal-plugin-encryption'; // required
import './index';

import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';

import config from './webex-config';

class Webex extends WebexCore {
  constructor(attrs) {
    super(attrs);
    this.webex = true;
    this.version = PACKAGE_VERSION;
  }

  static init(attrs = {}) {
    const newAttrs = {...attrs};
    newAttrs.config = merge({}, config, newAttrs.config);

    return new Webex(newAttrs);
  }
}

export default Webex;
