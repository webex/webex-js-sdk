/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {inBrowser} = require('@ciscospark/common');

if (inBrowser) {
  throw new Error('ciscospark/env cannot be used in browser environments');
}

const CiscoSpark = require('ciscospark');

const spark = new CiscoSpark({
  credentials: process.env.CISCOSPARK_ACCESS_TOKEN
});

module.exports = spark;
