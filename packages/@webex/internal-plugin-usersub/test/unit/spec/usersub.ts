/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Usersub from '@webex/internal-plugin-usersub';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-usersub', () => {
  describe('Usersub', () => {
    let webex;
    let clock;

    const testGuid = 'test-guid';
    const deviceId = 'dc5c6ab1-1feb-4a6e-be4e-88c48aaee7da';
    const testDeviceUrl = `https://wdm-a.wbx2.com/wdm/api/v1/devices/${deviceId}`;
    const testAppName = 'wxcc';
    const ttl = 120;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          usersub: Usersub,
        },
      });
      clock = sinon.useFakeTimers();
      webex.internal.device.userId = testGuid;
      webex.internal.device.url = testDeviceUrl;
    });

    afterEach(() => {
      clock.restore();
    });

    describe('#updateAnswerCallsCrossClient()', () => {
      it('requires a boolean to enable or disable composition to be passed', () =>
        assert.isRejected(
          webex.internal.usersub.updateAnswerCallsCrossClient('true'),
          /Enable parameter must be a boolean/
        ));

      it('requires an app name to be passed in the parameters', () =>
        assert.isRejected(
          webex.internal.usersub.updateAnswerCallsCrossClient(true, ''),
          /An appName is required/
        ));

      it('requires a ttl to be passed in the parameters', () =>
        assert.isRejected(
          webex.internal.usersub.updateAnswerCallsCrossClient(true, 'wxcc', 0),
          /A positive ttl is required/
        ));

      const testCases = [
        {enable: true, state: {'answer-calls-on-wxcc': true}},
        {enable: false, state: {'answer-calls-on-wxcc': false}},
      ];

      testCases.forEach(({enable, state}) => {
        it(`should set cross-client-state with answer-calls-on-wxcc: ${enable}`, async () => {
          webex.request = function (options) {
            return Promise.resolve({
              statusCode: 204,
              body: [],
              options,
            });
          };
          sinon.spy(webex, 'request');

          await webex.internal.usersub.updateAnswerCallsCrossClient(enable, testAppName, ttl);

          assert.calledOnce(webex.request);

          const request = webex.request.getCall(0);

          assert.equal(request.args[0].resource, 'publish');
          assert.equal(request.args[0].body.users.length, 1);
          assert.equal(request.args[0].body.users[0], 'test-guid');
          assert.equal(request.args[0].body.compositions.length, 1);
          assert.equal(request.args[0].body.compositions[0].type, 'cross-client-state');
          assert.equal(request.args[0].body.compositions[0].ttl, ttl);
          assert.equal(request.args[0].body.compositions[0].composition.devices.length, 1);
          const devices = request.args[0].body.compositions[0].composition.devices;
          assert.deepEqual(devices, [
            {
              appName: testAppName,
              deviceId,
              state,
            },
          ]);
        });
      });

      it('should auto refresh cross-client-state', async () => {
        webex.request = function (options) {
          return Promise.resolve({
            statusCode: 204,
            body: [],
            options,
          });
        };

        sinon.spy(webex, 'request');

        await webex.internal.usersub.updateAnswerCallsCrossClient(true, testAppName, ttl);
        assert.calledOnce(webex.request);
        assert.equal(webex.internal.usersub.crossClientState.get(testAppName), true);

        const time = 61 * 1000;
        clock.tick(time);
        await Promise.resolve();
        assert.calledTwice(webex.request);

        clock.tick(time);
        await Promise.resolve();
        assert.calledThrice(webex.request);
      });

      it('should not refresh cross-client-state after setting answer-calls-on-wxcc to false', async () => {
        webex.request = function (options) {
          return Promise.resolve({
            statusCode: 204,
            body: [],
            options,
          });
        };

        sinon.spy(webex, 'request');
        await webex.internal.usersub.updateAnswerCallsCrossClient(true, testAppName, ttl);
        assert.calledOnce(webex.request);
        assert.equal(webex.internal.usersub.crossClientState.get(testAppName), true);

        const time = 61 * 1000;
        clock.tick(time);
        assert.calledTwice(webex.request);

        await webex.internal.usersub.updateAnswerCallsCrossClient(false, testAppName, ttl);
        assert.calledThrice(webex.request);
        assert.equal(webex.internal.usersub.crossClientState.get(testAppName), false);

        clock.tick(time);
        assert.calledThrice(webex.request);
      });
      it('request to update cross-client-state fails', async () => {
        const errorMessage = 'Request failed';
        webex.request.rejects(new Error(errorMessage));

        await assert.isRejected(
          webex.internal.usersub.updateAnswerCallsCrossClient(true, testAppName, ttl),
          Error,
          errorMessage
        );
      });
      it('deviceId is empty', async () => {
        webex.internal.device.url = '';
        webex.request = function (options) {
          return Promise.resolve({
            statusCode: 204,
            body: [],
            options,
          });
        };
        sinon.spy(webex, 'request');

        await webex.internal.usersub.updateAnswerCallsCrossClient(true, testAppName, ttl);
        assert.calledOnce(webex.request);
        const request = webex.request.getCall(0);
        assert.isEmpty(request.args[0].body.compositions[0].composition.devices[0].deviceId);
      });
    });
  });
});
