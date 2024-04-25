/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import { getBrowserSerial } from '@webex/common';
import window from 'global/window';
import bowser from 'bowser';
import {browserDetection} from '@webex/common/src/constants.js';

describe('getBowserSerial()', () => {
  const originalWindowNavigator = {...window.navigator};

  afterEach(() => {
    window.navigator = originalWindowNavigator;
  });

  it('should provide the parsed bowser user agent when available', () => {
    //@ts-ignore
    window.navigator = {userAgent: 'user agent data'};

    const res = getBrowserSerial();
    assert.deepEqual(res._ua, 'user agent data');
  });

  it('should provide an error message when the user agent is not available', () => {
    //@ts-ignore
    window.navigator = undefined;

    const res = getBrowserSerial();
    assert.deepEqual(res, {error: browserDetection.unableToAccessUserAgent});
  });

  it('should provide an error message object when bowser.getParser() fails', () => {
    //@ts-ignore
    window.navigator = {userAgent: 'user agent data'};

    bowser.getParser = sinon.stub().throws(new Error('test error'));
    const res = getBrowserSerial();
    assert.deepEqual(res, {error: 'test error'});
  });
});

