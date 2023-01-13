/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {HttpStatusInterceptor} from '@webex/http-core';

describe('http-core', () => {
  describe('Interceptors', () => {
    describe('HttpStatusInterceptor', () => {
      let interceptor;

      beforeEach(() => {
        interceptor = Reflect.apply(
          HttpStatusInterceptor.create,
          {
            sessionId: 'mock-webex_uuid',
          },
          []
        );
      });

      describe('#onResponse', () => {
        it('resolves on locus redirect error', () => {
          const response = {
            statusCode: 404,
            body: {
              errorCode: 2000002,
            },
          };

          return interceptor.onResponse({}, response).then((result) => {
            assert.equal(result, response);
          });
        });
        it('rejects when locus redirect is not intended', () => {
          const response = {
            statusCode: 404,
            body: {
              errorCode: 2000001,
            },
          };

          assert.isRejected(interceptor.onResponse({}, response));
        });
      });
    });
  });
});
