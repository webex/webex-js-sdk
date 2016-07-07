/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

console.log('time to javascript ready', window.performance.now());

import React from 'react';
window.React = React;

require('./router.jsx');
