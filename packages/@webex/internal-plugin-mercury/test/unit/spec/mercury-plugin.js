/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {MercuryPlugin, config as mercuryConfig} from '@webex/internal-plugin-mercury';

describe('plugin-mercury', () => {
  describe('MercuryPlugin', () => {
    let webex, mercuryPlugin;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: MercuryPlugin,
        },
      });

      webex.internal.feature = {
        getFeature: sinon.stub().resolves(false),
      };

      webex.credentials = {
        refresh: sinon.stub().resolves(),
        getUserToken: sinon.stub().resolves({
          toString() {
            return 'Bearer FAKE';
          },
        }),
      };

      webex.internal.device = {
        register: sinon.stub().resolves(),
        refresh: sinon.stub().resolves(),
        webSocketUrl: 'ws://example.com',
        registered: true,
      };

      webex.internal.services = {
        convertUrlToPriorityHostUrl: sinon.stub().returns('ws://example.com'),
        markFailedUrl: sinon.stub().resolves(),
        isValidHost: sinon.stub().returns(true),
      };

      webex.internal.newMetrics = {
        callDiagnosticMetrics: {
          setMercuryConnectedStatus: sinon.stub(),
        },
      };

      webex.config.mercury = mercuryConfig.mercury;

      mercuryPlugin = webex.internal.mercury;
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#constructor()', () => {
      it('creates an instance with namespace Mercury', () => {
        assert.equal(mercuryPlugin.namespace, 'Mercury');
      });

      it('has an internal Mercury instance', () => {
        assert.isDefined(mercuryPlugin._mercury);
      });
    });

    describe('#connected', () => {
      it('returns false when Mercury is not connected', () => {
        assert.equal(mercuryPlugin.connected, false);
      });

      it('returns true when Mercury is connected', () => {
        mercuryPlugin._mercury.connected = true;
        assert.equal(mercuryPlugin.connected, true);
      });

      it('returns false when _mercury is undefined', () => {
        mercuryPlugin._mercury = undefined;
        assert.equal(mercuryPlugin.connected, false);
      });
    });

    describe('#socket', () => {
      it('returns undefined when no socket exists', () => {
        assert.isUndefined(mercuryPlugin.socket);
      });

      it('returns the socket when connected', () => {
        const mockSocket = {url: 'ws://test.com'};
        mercuryPlugin._mercury.socket = mockSocket;
        assert.equal(mercuryPlugin.socket, mockSocket);
      });
    });

    describe('#localClusterServiceUrls', () => {
      it('returns undefined when not set', () => {
        assert.isUndefined(mercuryPlugin.localClusterServiceUrls);
      });

      it('returns the localClusterServiceUrls when set', () => {
        const urls = {mercuryConnectionServiceClusterUrl: 'https://mercury.example.com'};
        mercuryPlugin._mercury.localClusterServiceUrls = urls;
        assert.deepEqual(mercuryPlugin.localClusterServiceUrls, urls);
      });

      it('returns undefined when _mercury is undefined', () => {
        mercuryPlugin._mercury = undefined;
        assert.isUndefined(mercuryPlugin.localClusterServiceUrls);
      });
    });

    describe('#getLastError()', () => {
      it('returns undefined when no error occurred', () => {
        assert.isUndefined(mercuryPlugin.getLastError());
      });

      it('returns the last error when one occurred', () => {
        const error = new Error('test error');
        mercuryPlugin._mercury.lastError = error;
        assert.equal(mercuryPlugin.getLastError(), error);
      });
    });

    describe('#hasEverConnected', () => {
      it('returns false when never connected', () => {
        assert.equal(mercuryPlugin.hasEverConnected, false);
      });

      it('returns true when has connected before', () => {
        mercuryPlugin._mercury.hasEverConnected = true;
        assert.equal(mercuryPlugin.hasEverConnected, true);
      });

      it('returns false when _mercury is undefined', () => {
        mercuryPlugin._mercury = undefined;
        assert.equal(mercuryPlugin.hasEverConnected, false);
      });
    });

    describe('#connect()', () => {
      it('delegates to Mercury.connect()', () => {
        const connectStub = sinon.stub(mercuryPlugin._mercury, 'connect').resolves();
        const webSocketUrl = 'ws://custom.com';

        mercuryPlugin.connect(webSocketUrl);

        sinon.assert.calledOnceWithExactly(connectStub, webSocketUrl);
      });

      it('calls connect without URL when none provided', () => {
        const connectStub = sinon.stub(mercuryPlugin._mercury, 'connect').resolves();

        mercuryPlugin.connect();

        sinon.assert.calledOnceWithExactly(connectStub, undefined);
      });
    });

    describe('#disconnect()', () => {
      it('delegates to Mercury.disconnect()', () => {
        const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();
        const options = {code: 1000, reason: 'test'};

        mercuryPlugin.disconnect(options);

        sinon.assert.calledOnceWithExactly(disconnectStub, options);
      });

      it('calls disconnect without options when none provided', () => {
        const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();

        mercuryPlugin.disconnect();

        sinon.assert.calledOnceWithExactly(disconnectStub, undefined);
      });
    });

    describe('#logout()', () => {
      it('calls disconnect with code 3050 when reason is not a normal reconnect reason', () => {
        const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();
        mercuryPlugin.config.beforeLogoutOptionsCloseReason = 'done (permanent)';

        mercuryPlugin.logout();

        sinon.assert.calledOnceWithExactly(disconnectStub, {
          code: 3050,
          reason: 'done (permanent)',
        });
      });

      it('calls disconnect with undefined when reason is a normal reconnect reason', () => {
        const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();
        mercuryPlugin.config.beforeLogoutOptionsCloseReason = 'idle';

        mercuryPlugin.logout();

        sinon.assert.calledOnceWithExactly(disconnectStub, undefined);
      });

      it('calls disconnect with undefined when no reason configured', () => {
        const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();
        mercuryPlugin.config.beforeLogoutOptionsCloseReason = undefined;

        mercuryPlugin.logout();

        sinon.assert.calledOnceWithExactly(disconnectStub, undefined);
      });

      [
        {reason: 'idle', expectUndefined: true},
        {reason: 'done (forced)', expectUndefined: true},
        {reason: 'pong not received', expectUndefined: true},
        {reason: 'pong mismatch', expectUndefined: true},
        {reason: 'custom reason', expectUndefined: false},
        {reason: 'done (permanent)', expectUndefined: false},
      ].forEach(({reason, expectUndefined}) => {
        it(`calls disconnect with ${expectUndefined ? 'undefined' : 'code 3050'} for reason "${reason}"`, () => {
          const disconnectStub = sinon.stub(mercuryPlugin._mercury, 'disconnect').resolves();
          mercuryPlugin.config.beforeLogoutOptionsCloseReason = reason;

          mercuryPlugin.logout();

          if (expectUndefined) {
            sinon.assert.calledOnceWithExactly(disconnectStub, undefined);
          } else {
            sinon.assert.calledOnceWithExactly(disconnectStub, {code: 3050, reason});
          }
        });
      });
    });

    describe('#processRegistrationStatusEvent()', () => {
      it('delegates to Mercury.processRegistrationStatusEvent()', () => {
        const processStub = sinon
          .stub(mercuryPlugin._mercury, 'processRegistrationStatusEvent')
          .returns();
        const message = {localClusterServiceUrls: {test: 'url'}};

        mercuryPlugin.processRegistrationStatusEvent(message);

        sinon.assert.calledOnceWithExactly(processStub, message);
      });
    });

    describe('event re-emission', () => {
      it('re-emits events from Mercury to the plugin', (done) => {
        const testData = {test: 'data'};

        mercuryPlugin.on('event:test', (data) => {
          assert.deepEqual(data, testData);
          done();
        });

        mercuryPlugin._mercury.trigger('event:test', testData);
      });

      it('re-emits online event', (done) => {
        mercuryPlugin.on('online', () => {
          done();
        });

        mercuryPlugin._mercury.trigger('online');
      });

      it('re-emits offline event', (done) => {
        mercuryPlugin.on('offline', (event) => {
          assert.deepEqual(event, {code: 1000, reason: 'test'});
          done();
        });

        mercuryPlugin._mercury.trigger('offline', {code: 1000, reason: 'test'});
      });
    });
  });
});
