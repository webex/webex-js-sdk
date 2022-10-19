/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {DefaultOptionsInterceptor} from '@webex/webex-core';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('DefaultOptionsInterceptor', () => {
      describe('#onRequest()', () => {
        it('interceptor ok when defaultRequestOptions is undefined', () => {
          const interceptor = Reflect.apply(DefaultOptionsInterceptor.create, {
            config: {
              appVersion: '1.0.0'
              // defaultRequestOptions omitted/undefined here
            }
          }, []);

          const options = {
            existingOption: 'bar'
          };

          interceptor.onRequest(options);
          assert.property(options, 'existingOption');
          assert.equal(options.existingOption, 'bar');
        });

        it('add default options to existing options', () => {
          const interceptor = Reflect.apply(DefaultOptionsInterceptor.create, {
            config: {
              defaultRequestOptions: {
                myNewOption1: 'foo1',
                myNewOption2: 'foo2'
              }
            }
          }, []);

          const options = {
            existingOption: 'bar'
          };

          interceptor.onRequest(options);
          assert.property(options, 'myNewOption1');
          assert.equal(options.myNewOption1, 'foo1');
          assert.property(options, 'myNewOption2');
          assert.equal(options.myNewOption2, 'foo2');
          assert.property(options, 'existingOption');
          assert.equal(options.existingOption, 'bar');
        });

        it('default option does not override existing option', () => {
          const interceptor = Reflect.apply(DefaultOptionsInterceptor.create, {
            config: {
              defaultRequestOptions: {
                existingOption: 'foo'
              }
            }
          }, []);

          const options = {
            existingOption: 'bar'
          };

          interceptor.onRequest(options);
          assert.property(options, 'existingOption');
          assert.equal(options.existingOption, 'bar');
        });
      });
    });
  });
});
