/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import Logger from '@webex/plugin-logger';
import MockWebex from '@webex/test-helper-mock-webex';
import {AuthInterceptor, config, Credentials, WebexHttpError, Token} from '@webex/webex-core';
import {cloneDeep, merge} from 'lodash';
import Metrics from '@webex/internal-plugin-metrics';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('AuthInterceptor', () => {
      let interceptor, webex;

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            credentials: Credentials,
            logger: Logger,
            metrics: Metrics,
          },
          config: merge(cloneDeep(config), {credentials: {client_secret: 'fake'}}),
        });

        webex.credentials.supertoken = new Token(
          {
            access_token: 'ST1',
            token_type: 'Bearer',
          },
          {parent: webex}
        );

        interceptor = Reflect.apply(AuthInterceptor.create, webex, []);
        sinon.stub(webex.internal.metrics, 'submitClientMetrics').callsFake(() => {});
      });


      describe('#onResponseError()', () => {
        describe('when the server responds with 401', () => {
          browserOnly(it)('refreshes the access token and replays the request', () => {
            webex.config.credentials.refreshCallback = sinon.stub().returns(
              Promise.resolve({
                access_token: 'ST2',
              })
            );

            webex.credentials.supertoken = new Token(
              {
                access_token: 'ST1',
                refresh_token: 'RT1',
              },
              {parent: webex}
            );

            const err = new WebexHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg',
                },
                uri: `${config.services.discovery.hydra}/ping`,
              },
              body: {
                error: 'fake error',
              },
            });

            assert.notCalled(webex.request);

            return interceptor.onResponseError(err.options, err).then(() => {
              // once for replay
              assert.calledOnce(webex.request);
              assert.equal(webex.credentials.supertoken.access_token, 'ST2');
              assert.equal(webex.request.args[0][0].replayCount, 1);
            });
          });
      });
    });
  });
});
});
