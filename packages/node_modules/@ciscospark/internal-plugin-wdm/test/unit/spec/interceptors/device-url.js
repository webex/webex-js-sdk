/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Device, {DeviceUrlInterceptor} from '@ciscospark/internal-plugin-wdm';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe('plugin-wdm', () => {
  describe('DeviceUrlInterceptor', () => {
    let interceptor, spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.internal.device.url = 'https://wdm-a.example.com/devices/id';

      spark.internal.device.services = {
        conversationServiceUrl: 'https://conv-a.example.com'
      };

      interceptor = new DeviceUrlInterceptor({spark});
    });

    describe('#onRequest()', () => {
      it('adds cisco-device-url to the request header for service catalog services', () => interceptor.onRequest({
        service: 'conversation',
        resource: 'conversations/id'
      })
        .then((options) => {
          assert.isDefined(options.headers['cisco-device-url']);
          assert.equal(options.headers['cisco-device-url'], spark.internal.device.url);
        }));

      it('adds cisco-device-url to the request header for service catalog urls', () => interceptor.onRequest({
        uri: 'https://conv-a.example.com/conversations/id'
      })
        .then((options) => {
          assert.isDefined(options.headers['cisco-device-url']);
          assert.equal(options.headers['cisco-device-url'], spark.internal.device.url);
        }));

      it('does not add cisco-device-url to login requests', () => interceptor.onRequest({
        service: 'oauth',
        resource: 'access_token'
      })
        .then((options) => {
          assert.isUndefined(options.headers && options.headers['cisco-device-url']);
        }));

      it('does not add cisco-device-url to other CI requests', () => interceptor.onRequest({
        service: 'saml',
        resource: 'access_token'
      })
        .then((options) => {
          assert.isUndefined(options.headers && options.headers['cisco-device-url']);
        }));

      it('does not add cisco-device-url to unknown urls', () => interceptor.onRequest({
        uri: 'https://random.example.com/not-a-service'
      })
        .then((options) => {
          assert.isUndefined(options.headers && options.headers['cisco-device-url']);
        }));
    });
  });
});
