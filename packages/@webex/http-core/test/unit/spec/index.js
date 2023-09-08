import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import * as utils from '@webex/http-core/src/request/utils';
import WebexTrackingIdInterceptor from '@webex/webex-core/src/interceptors/webex-tracking-id';
import UserAgentInterceptor from '@webex/webex-core/src/interceptors/webex-user-agent';
import {protoprepareFetchOptions, setTimingsAndFetch} from '@webex/http-core/src/index';

describe('http-core index tests', () => {
  describe('#protoprepareFetchOptions()', () => {
    it('uses default options and adds expected options', async () => {
      const defaultOptions = {
        interceptors: [WebexTrackingIdInterceptor.create(), UserAgentInterceptor.create()],
      };
      const options = {};

      const prepareFetchOptions = protoprepareFetchOptions(defaultOptions);

      await prepareFetchOptions(options);

      assert.deepEqual(options, {
        headers: {
          trackingid: 'undefined_1',
          'spark-user-agent': 'webex-js-sdk/development (node)',
        },
        keepalive: true,
      });

      assert.equal(typeof options.logger, 'object');
      assert.equal(typeof options.upload, 'object');
      assert.equal(typeof options.download, 'object');
      assert.isArray(options.interceptors);
    });
  });

  describe('#setTimingsAndFetch()', () => {
    const now = Date.now();
    let stubbedFetch;

    beforeEach(() => {
      global.fetch = sinon.stub();
    });

    it('calls fetch with expected options', async () => {
      sinon.useFakeTimers(now);
      const options = {uri: 'foo'};

      const newOptions = setTimingsAndFetch(options);

      sinon.assert.calledOnce(global.fetch);
      sinon.assert.calledWith(global.fetch, 'foo', {
        uri: 'foo',
        $timings: {requestStart: now, networkStart: now},
      });
      sinon.restore();
    });
  });
});
