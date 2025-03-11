/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-underscore-dangle */
import sinon from 'sinon';
import Support from '@webex/internal-plugin-support';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-support', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        support: Support,
      },
    });

    webex.internal.device.userId = 'user-abc-123';
    webex.internal.device.orgId = 'org-abc-123';
    webex.internal.support.config.appVersion = '0.0.0.0';
  });

  describe('#_constructFileMetadata()', () => {
    it('constructs a sample File Meta Data', () => {
      const result = webex.internal.support._constructFileMetadata({});

      assert.equal(result.length, 4);
      assert.deepEqual(result, [
        {
          key: 'trackingId',
          value: 'mock-webex_88888888-4444-4444-4444-aaaaaaaaaaaa',
        },
        {
          key: 'appVersion',
          value: '0.0.0.0',
        },
        {
          key: 'userId',
          value: webex.internal.device.userId,
        },
        {
          key: 'orgId',
          value: webex.internal.device.orgId,
        },
      ]);
    });

    it('does not send sessionId key if sessionId is not defined', () => {
      webex.sessionId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'sessionId').length === 0);
    });

    it('does not send userID key if device userId is not defined', () => {
      webex.internal.device.userId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'userId').length === 0);
    });

    it('does not send orgId key if device orgId is not defined', () => {
      webex.internal.device.orgId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'orgId').length === 0);
    });

    it('sends surveySessionId if specified in metadata', () => {
      const surveySessionId = 'survey-session-id';
      const result = webex.internal.support._constructFileMetadata({surveySessionId});
      const found = result.find((attr) => attr.key === 'surveySessionId');

      assert.equal(found?.value, surveySessionId);
    });

    it('sends productAreaTag if specified in metadata', () => {
      const productAreaTag = 'product-area-tag';
      const result = webex.internal.support._constructFileMetadata({productAreaTag});
      const found = result.find((attr) => attr.key === 'productAreaTag');

      assert.equal(found?.value, productAreaTag);
    });

    it('sends issueTypeTag if specified in metadata', () => {
      const issueTypeTag = 'issueTypeTag';
      const result = webex.internal.support._constructFileMetadata({issueTypeTag});
      const found = result.find((attr) => attr.key === 'issueTypeTag');

      assert.equal(found?.value, issueTypeTag);
    });

    it('sends locussessionid if specified in metadata', () => {
      const locussessionid = 'locussessionid';
      const result = webex.internal.support._constructFileMetadata({locussessionid});
      const found = result.find((attr) => attr.key === 'locussessionid');

      assert.equal(found?.value, locussessionid);
    });

    it('sends locusId if specified in metadata', () => {
      const locusId = 'locusId';
      const result = webex.internal.support._constructFileMetadata({locusId});
      const found = result.find((attr) => attr.key === 'locusId');

      assert.equal(found?.value, locusId);
    });

    it('sends callStart if specified in metadata', () => {
      const callStart = 'callStart';
      const result = webex.internal.support._constructFileMetadata({callStart});
      const found = result.find((attr) => attr.key === 'callStart');

      assert.equal(found?.value, callStart);
    });

    it('sends feedbackId if specified in metadata', () => {
      const feedbackId = 'feedbackId';
      const result = webex.internal.support._constructFileMetadata({feedbackId});
      const found = result.find((attr) => attr.key === 'feedbackId');

      assert.equal(found?.value, feedbackId);
    });

    it('sends correlationId if specified in metadata', () => {
      const correlationId = 'correlationId';
      const result = webex.internal.support._constructFileMetadata({correlationId});
      const found = result.find((attr) => attr.key === 'correlationId');

      assert.equal(found?.value, correlationId);
    });

    it('sends meetingId if specified in metadata', () => {
      const meetingId = 'meetingId';
      const result = webex.internal.support._constructFileMetadata({meetingId});
      const found = result.find((attr) => attr.key === 'meetingId');

      assert.equal(found?.value, meetingId);
    });

    it('sends autoupload if specified in metadata', () => {
      const autoupload = 'autoupload';
      const result = webex.internal.support._constructFileMetadata({autoupload});
      const found = result.find((attr) => attr.key === 'autoupload');

      assert.equal(found?.value, autoupload);
    });

    it('sends issuedesctag if specified in metadata', () => {
      const issueDescTag = 'issueDescTag';
      const result = webex.internal.support._constructFileMetadata({issueDescTag});
      const found = result.find((attr) => attr.key === 'issueDescTag');

      assert.equal(found?.value, issueDescTag);
    });
  });

  describe('#submitLogs()', () => {
    beforeEach(() => {
      webex.logger = {
        formatLogs: sinon.stub().returns(['fake logs']),
        sdkBuffer: [],
        clientBuffer: [],
        buffer: [],
      };
      webex.upload = sinon.stub().returns(Promise.resolve({}));
    });

    it('calls getUserToken', () => {
      webex.internal.support.submitLogs({});
      assert.calledOnce(webex.credentials.getUserToken);
    });

    [
      {type: undefined, incrementalLogsConfig: true, expectedDiff: true},
      {type: undefined, incrementalLogsConfig: false, expectedDiff: false},

      {type: 'full', incrementalLogsConfig: true, expectedDiff: false}, // the sendFullLog param overrides the config
      {type: 'full', incrementalLogsConfig: false, expectedDiff: false},

      {type: 'diff', incrementalLogsConfig: true, expectedDiff: true},
      {type: 'diff', incrementalLogsConfig: false, expectedDiff: true}, // the sendFullLog param overrides the config
    ].forEach(({type, incrementalLogsConfig, expectedDiff}) => {
      it(`submits ${
        expectedDiff ? 'incremental' : 'full'
      } logs if called with options.type=${type} and config.incrementalLogs=${incrementalLogsConfig}`, async () => {
        webex.internal.support.config.incrementalLogs = incrementalLogsConfig;
        if (type !== undefined) {
          await webex.internal.support.submitLogs({}, undefined, {type});
        } else {
          await webex.internal.support.submitLogs({});
        }

        assert.calledOnceWithExactly(webex.logger.formatLogs, {diff: expectedDiff});
        assert.calledOnce(webex.upload);

        const uploadArgs = webex.upload.args[0];

        assert.deepEqual(uploadArgs[0].file, ['fake logs']);
      });

      it('submits provided logs', async () => {
        webex.internal.support.config.incrementalLogs = incrementalLogsConfig;
        const testLogs = ['test logs'];

        await webex.internal.support.submitLogs({}, testLogs);

        assert.notCalled(webex.logger.formatLogs);
        assert.calledOnce(webex.upload);

        const uploadArgs = webex.upload.args[0];

        assert.deepEqual(uploadArgs[0].file, ['test logs']);
      });
    });
  });
});
