/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Presence from '@webex/plugin-presence';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-presence', () => {
  describe('Presence', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          presence: Presence,
        },
      });
      webex.config.presence = {};
    });

    describe('#get()', () => {
      it('requires a person id parameter', () => {
        assert.isRejected(webex.presence.get(), /A person id is required/);
      });
    });

    describe('#list()', () => {
      it('requires a parameter', () =>
        assert.isRejected(webex.presence.list(), /An array of person ids is required/));

      it('requires a person array parameter', () =>
        assert.isRejected(webex.presence.list('abc'), /An array of person ids is required/));
    });

    describe('#subscribe()', () => {
      it('requires a person parameter', () =>
        assert.isRejected(webex.presence.subscribe(), /A person id is required/));
      it('subscription request called twice with batch of 100 ids', () => {
        const ids = [...Array(100).keys()];

        webex.request = function (options) {
          return Promise.resolve({
            statusCode: 204,
            body: [],
            options,
          });
        };
        sinon.spy(webex, 'request');

        webex.presence.subscribe(ids);
        assert.calledTwice(webex.request);
      });
    });

    describe('#unsubscribe()', () => {
      it('requires a person parameter', () =>
        assert.isRejected(webex.presence.unsubscribe(), /A person id is required/));
    });

    describe('#setStatus()', () => {
      it('requires a status', () =>
        assert.isRejected(webex.presence.setStatus(), /A status is required/));

      it('passes a label to the API', () => {
        const testGuid = 'test-guid';

        webex.internal.device.userId = testGuid;

        webex.request = function (options) {
          return Promise.resolve({
            statusCode: 204,
            body: [],
            options,
          });
        };
        sinon.spy(webex, 'request');

        webex.presence.setStatus('dnd');

        assert.calledOnce(webex.request);

        const request = webex.request.getCall(0);

        assert.equal(request.args[0].body.label, testGuid);
      });
    });

    describe('#initializeWorker()', () => {
      it('initializes the worker once webex is ready', () => {
        webex.presence.worker = {initialize: sinon.spy()};
        webex.presence.config.initializeWorker = false;

        webex.presence.initializeWorker();

        assert.notCalled(webex.presence.worker.initialize);

        webex.trigger('ready');

        assert.calledOnce(webex.presence.worker.initialize);
      });
    });
  });
});
