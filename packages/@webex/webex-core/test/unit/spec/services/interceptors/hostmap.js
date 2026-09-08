/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {HostMapInterceptor, config, Credentials} from '@webex/webex-core';
import {cloneDeep} from 'lodash';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('HostMapInterceptor', () => {
      let interceptor, webex;

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            credentials: Credentials,
          },
          config: cloneDeep(config),
          request: sinon.spy(),
        });

        webex.internal.services = {
          replaceHostFromHostmap: sinon.stub().returns('http://replaceduri.com'),
        }

        interceptor = Reflect.apply(HostMapInterceptor.create, webex, []);
      });

      describe('#onRequest', () => {
        it('calls replaceHostFromHostmap if options.uri is defined', () => {
          const options = {
            uri: 'http://example.com',
          };

          interceptor.onRequest(options);

          sinon.assert.calledWith(
            webex.internal.services.replaceHostFromHostmap,
            'http://example.com'
          );

          assert.equal(options.uri, 'http://replaceduri.com');
        });

        it('does not call replaceHostFromHostmap if options.uri is not defined', () => {
          const options = {};

          interceptor.onRequest(options);

          sinon.assert.notCalled(webex.internal.services.replaceHostFromHostmap);

          assert.isUndefined(options.uri);
        });

        it('does not modify options.uri if replaceHostFromHostmap throws an error', () => {
          const options = {
            uri: 'http://example.com',
          };

          webex.internal.services.replaceHostFromHostmap.throws(new Error('replaceHostFromHostmap error'));

          interceptor.onRequest(options);

          sinon.assert.calledWith(
            webex.internal.services.replaceHostFromHostmap,
            'http://example.com'
          );

          assert.equal(options.uri, 'http://example.com');
        });
      });
    });
  });
});
