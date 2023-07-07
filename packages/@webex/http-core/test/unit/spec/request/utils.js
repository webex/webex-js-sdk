import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import * as utils from '@webex/http-core/src/request/utils';
import WebexTrackingIdInterceptor from '@webex/webex-core/src/interceptors/webex-tracking-id';
import UserAgentInterceptor from '@webex/webex-core/src/interceptors/webex-user-agent';

describe('Request utils', () => {
  describe('#intercept()', () => {
    it('updates options from interceptors', async () => {
      const options = {};
      const interceptors = [WebexTrackingIdInterceptor.create(), UserAgentInterceptor.create()];

      return utils.intercept(options, interceptors, 'Request').then(() => {
        assert.equal(Object.keys(options.headers).length, 2);
        assert.equal(options.headers.trackingid, 'undefined_1');
        assert.equal(options.headers['spark-user-agent'], 'webex-js-sdk/development (node)');
      });
    });
  });

  describe('#prepareFetchOptions()', () => {
    it('updates options as expected', async () => {
      const options = {
        interceptors: [WebexTrackingIdInterceptor.create(), UserAgentInterceptor.create()],
      };

      return utils.prepareFetchOptions(options).then(() => {
        assert.equal(Object.keys(options.headers).length, 2);

        assert.equal(options.download != undefined, true);
        assert.equal(options.upload != undefined, true);
      });
    });
  });
});
