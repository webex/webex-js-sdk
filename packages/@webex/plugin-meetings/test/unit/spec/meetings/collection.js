/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MeetingCollection from '@webex/plugin-meetings/src/meetings/collection';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import uuid from 'uuid';

describe('plugin-meetings', () => {
  const logger = {
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {}
  };

  beforeEach(() => {
    LoggerConfig.set({verboseEvents: true, enable: false});
    LoggerProxy.set(logger);
  });
  describe('meetings collection', () => {
    let uuid1;
    let uuid2;
    let meetingCollection;

    beforeEach(() => {
      uuid1 = uuid.v4();
      uuid2 = uuid.v4();
      meetingCollection = new MeetingCollection();
    });
    describe('#set', () => {
      it('should set the meeting', () => {
        assert.equal(Object.keys(meetingCollection.meetings).length, 0);
        meetingCollection.set({id: uuid1});
        assert.equal(Object.keys(meetingCollection.meetings).length, 1);
      });
    });
    describe('#getByKey', () => {
      beforeEach(() => {
        meetingCollection.meetings.test = {value: 'test', id: uuid1};
        meetingCollection.meetings.test2 = {value: 'test2', id: uuid2};
      });
      it('should get the meeting by key', () => {
        assert.equal(Object.keys(meetingCollection.meetings).length, 2);
        assert.deepEqual(meetingCollection.getByKey('value', 'test'), {value: 'test', id: uuid1});
      });
    });
  });
});
