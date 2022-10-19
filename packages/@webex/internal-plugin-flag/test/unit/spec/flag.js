/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Flag from '@webex/internal-plugin-flag';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-flag', () => {
  describe('Flag', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          flag: Flag
        }
      });
    });

    describe('#flag()', () => {
      it('requires an activity URL', () => assert.isRejected(webex.internal.flag.create({}, {}), /`activity.url` is required/));
    });

    describe('#unflag()', () => {
      it('requires a Flag Id', () => assert.isRejected(webex.internal.flag.unflag({}, {}), /`flag.url` is required/));
    });

    describe('#archive()', () => {
      it('requires a Flag Id', () => assert.isRejected(webex.internal.flag.archive({}, {}), /`flag.url` is required/));
    });

    describe('#remove()', () => {
      it('requires a Flag Id', () => assert.isRejected(webex.internal.flag.delete({}, {}), /`flag.url` is required/));
    });
  });
});
