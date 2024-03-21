/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {RequestTimingInterceptor} from '@webex/webex-core';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('RequestTimingInterceptor', () => {
      let interceptor;

      beforeEach(() => {
        interceptor = RequestTimingInterceptor.create();
      });

      describe('.onRequest()', () => {
        it('adds a $timings object to options if one is not already there', () => {
          const options = {};

          interceptor.onRequest(options);
          assert.property(options, '$timings');
        });

        it('adds a requestStart time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          interceptor.onRequest(options);
          assert.property(options, '$timings');
          assert.property(options.$timings, 'requestStart');
        });
      });

      describe('.onRequestError()', () => {
        it('adds a requestEnd time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          return assert.isRejected(interceptor.onRequestError(options)).then(() => {
            assert.property(options.$timings, 'requestEnd');
          });
        });

        it('adds a requestFail time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          return assert.isRejected(interceptor.onRequestError(options)).then(() => {
            assert.property(options.$timings, 'requestFail');
          });
        });
      });

      describe('.onResponse()', () => {
        it('adds a requestEnd time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          interceptor.onResponse(options);
          assert.property(options.$timings, 'requestEnd');
        });
      });

      describe('.onResponseError()', () => {
        it('adds a requestEnd time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          return assert.isRejected(interceptor.onResponseError(options)).then(() => {
            assert.property(options.$timings, 'requestEnd');
          });
        });

        it('adds a requestFail time to options.$timings', () => {
          const options = {
            $timings: {},
          };

          return assert.isRejected(interceptor.onResponseError(options)).then(() => {
            assert.property(options.$timings, 'requestFail');
          });
        });
      });
    });
  });
});
