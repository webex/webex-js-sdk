/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const {inBrowser} = require('@webex/common');

if (inBrowser) {
  throw new Error('webex/env cannot be used in browser environments');
}

const Webex = require('webex');

const webex = new Webex({
  credentials: process.env.WEBEX_ACCESS_TOKEN,
});

module.exports = webex;
