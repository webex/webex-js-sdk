import {assert} from '@webex/test-helper-chai';
import {cloneDeep} from 'lodash';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Device from '@webex/internal-plugin-device';
import {CatalogDetails} from '@webex/internal-plugin-device';

import dto from './wdm-dto';

const waitForAsync = () =>
  new Promise((resolve) =>
    setImmediate(() => {
      return resolve();
    })
  );

describe('plugin-device', () => {
  describe('Device', () => {
    let webex;
    let device;

    beforeEach(() => {
      const fakeStorage = {};
      webex = new MockWebex({
        children: {
          device: Device,
        },
        getWindow: () => ({
          sessionStorage: {
            setItem: (key, value) => {
              fakeStorage[key] = value;
            },
            getItem: (key) => fakeStorage[key],
          },
        }),
      });

      const clonedDTO = cloneDeep(dto);

      webex.internal.device.set(clonedDTO);

      device = webex.internal.device;
    });

    describe('events', () => {
      describe('when a feature is changed', () => {
        let spy;
        let modifiedDTOFeatures;

        beforeEach(() => {
          spy = sinon.spy();
          modifiedDTOFeatures = {
            ...dto.features,
            user: [...dto.features.user, ...dto.features.developer],
          };
        });

        it("should trigger a 'change' event", () => {
          device.on('change', spy);
          device.features.set(modifiedDTOFeatures);
          assert.called(spy);
        });

        it("should trigger a 'change:features' event", () => {
          device.on('change:features', spy);
          device.features.set(modifiedDTOFeatures);
          assert.called(spy);
        });
      });

      describe('when an network inactivity property changes', () => {
        beforeEach(() => {
          device.checkNetworkReachability = sinon.spy();
        });

        describe("when the 'intranetInactivityCheckUrl' changes", () => {
          beforeEach(() => {
            device.intranetInactivityCheckUrl = 'https://not-a-url.com';
          });

          it("should call 'checkNetworkReachability()'", () => {
            assert.called(device.checkNetworkReachability);
          });

          it('should set isReachabilityChecked to true', () => {
            assert.isTrue(device.isReachabilityChecked);
          });
        });

        describe("when the 'intranetInactivityDuration' changes", () => {
          beforeEach(() => {
            device.intranetInactivityDuration = 1234;
          });

          it("should call 'checkNetworkReachability()'", () => {
            assert.called(device.checkNetworkReachability);
          });

          it('should set isReachabilityChecked to true', () => {
            assert.isTrue(device.isReachabilityChecked);
          });
        });

        describe("when the 'inNetworkInactivityDuration' changes", () => {
          beforeEach(() => {
            device.inNetworkInactivityDuration = 1234;
          });

          it("should call 'checkNetworkReachability()'", () => {
            assert.called(device.checkNetworkReachability);
            assert.isTrue(device.isReachabilityChecked);
          });
        });
      });

      describe('when the config is changed', () => {
        it("should unset the 'etag' if debug features are set", () => {
          device.set('etag', 'etag-value');
          device.config.debugFeatureTogglesKey = 'debug-feature-toggles';

          webex.getWindow().sessionStorage.setItem(
            'debug-feature-toggles',
            JSON.stringify({
              test_feature: true,
            })
          );
          assert.equal(device.etag, 'etag-value');

          webex.trigger('change:config');
          assert.isUndefined(device.etag);
        });

        it("should not unset the 'etag' if debug features are not set", () => {
          device.set('etag', 'etag-value');
          device.config.debugFeatureTogglesKey = 'debug-feature-toggles';

          assert.equal(device.etag, 'etag-value');

          webex.trigger('change:config');
          assert.equal(device.etag, 'etag-value');
        });

        it("should only unset the 'etag' the first time the event is sent", () => {
          device.set('etag', 'etag-value');
          device.config.debugFeatureTogglesKey = 'debug-feature-toggles';

          webex.getWindow().sessionStorage.setItem(
            'debug-feature-toggles',
            JSON.stringify({
              test_feature: true,
            })
          );
          assert.equal(device.etag, 'etag-value');

          webex.trigger('change:config');
          assert.isUndefined(device.etag);

          device.set('etag', 'etag-value');
          webex.trigger('change:config');
          assert.equal(device.etag, 'etag-value');
        });
      });
    });

    describe('derived properties', () => {
      describe('#registered', () => {
        describe('when the device does not have a url', () => {
          beforeEach(() => {
            device.url = undefined;
          });

          it('should return false', () => {
            assert.isFalse(device.registered);
          });
        });

        describe('when the device does have a url', () => {
          beforeEach(() => {
            device.url = dto.url;
          });

          it('should return true', () => {
            assert.isTrue(device.registered);
          });
        });
      });
    });

    describe('#setLogoutTimer()', () => {
      describe('when the duration parameter is not set', () => {
        it('should not change the existing timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer();
          assert.equal(device.logoutTimer, logoutTimer);
        });
      });

      describe('when the duration parameter is zero or negative', () => {
        it('should not change the existing timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer(-1);
          assert.equal(device.logoutTimer, logoutTimer);
        });
      });

      describe('when the duration is valid', () => {
        beforeEach(() => {
          device.resetLogoutTimer = sinon.spy();
        });

        it("should create a 'change:lastUserActivityDate' listener", () => {
          device.setLogoutTimer(60000);
          device.trigger('change:lastUserActivityDate');
          assert.called(device.resetLogoutTimer);
        });

        it('should set the logout timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer(60000);
          assert.notEqual(device.logoutTimer, logoutTimer);
        });
      });
    });

    describe('#serialize()', () => {
      it('should serialize entitlement feature keys', () => {
        assert.hasAllKeys(
          device.serialize().features.entitlement,
          Object.keys(dto.features.entitlement)
        );
      });

      it('should serialize user feature keys', () => {
        assert.hasAllKeys(device.serialize().features.user, Object.keys(dto.features.user));
      });
    });

    describe('#refresh()', () => {
      let requestSpy;

      const setup = (config = {}) => {
        webex.internal.metrics.submitClientMetrics = sinon.stub();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        sinon.stub(device, 'processRegistrationSuccess').callsFake(() => {});
        requestSpy = sinon.spy(device, 'request');
        device.config.defaults = {};
        Object.keys(config).forEach((key) => {
          device.config[key] = config[key];
        });
        device.set('registered', true);
      };

      afterEach(() => {
        sinon.restore();
      });

      it('If-None-Match header is added if etag is set', async () => {
        setup();

        device.set('etag', 'etag-value');

        const result = device.refresh();

        await result;

        assert.deepEqual(requestSpy.args[0][0].headers, {
          'If-None-Match': 'etag-value',
        });
      });

      it('If-None-Match header is not added if etag is not set', async () => {
        setup();

        const result = device.refresh();

        await result;

        assert.deepEqual(requestSpy.args[0][0].headers, {});
      });

      it('calls request with the expected properties when includeDetails is not specified', async () => {
        setup();

        const registerSpy = sinon.spy(device, 'register');
        device.setEnergyForecastConfig(false);
        device.set('registered', true);

        await device.refresh();

        assert.calledWith(requestSpy, {
          method: 'PUT',
          uri: 'https://locus-a.wbx2.com/locus/api/v1/devices/88888888-4444-4444-4444-CCCCCCCCCCCC',
          body: sinon.match.any,
          headers: {},
          qs: {includeUpstreamServices: CatalogDetails.all},
        });

        assert.notCalled(registerSpy);
      });

      it('calls request with the expected properties when includeDetails is specified', async () => {
        setup();

        const registerSpy = sinon.spy(device, 'register');
        device.setEnergyForecastConfig(false);
        device.set('registered', true);

        await device.refresh({includeDetails: CatalogDetails.features});

        assert.calledWith(requestSpy, {
          method: 'PUT',
          uri: 'https://locus-a.wbx2.com/locus/api/v1/devices/88888888-4444-4444-4444-CCCCCCCCCCCC',
          body: sinon.match.any,
          headers: {},
          qs: {includeUpstreamServices: CatalogDetails.features},
        });

        assert.notCalled(registerSpy);
      });

      it('calls register with default includeDetails when not registered', async () => {
        setup();

        const registerSpy = sinon.stub(device, 'register').callsFake(() => Promise.resolve());
        device.setEnergyForecastConfig(false);
        device.set('registered', false);

        await device.refresh();

        assert.calledWith(registerSpy, {});
      });

      it('uses the energy forecast config to append upstream services to the outgoing call', async () => {
        setup({energyForecast: true});
        device.setEnergyForecastConfig(true);
        device.set('registered', false);

        await device.register();

        assert.calledWith(
          requestSpy,
          sinon.match({
            qs: {includeUpstreamServices: 'all,energyforecast'},
          })
        );
      });

      it('uses the energy forecast config to not append upstream services to the outgoing call', async () => {
        setup({energyForecast: true});
        device.setEnergyForecastConfig(false);
        device.set('registered', false);

        await device.register();

        assert.calledWith(
          requestSpy,
          sinon.match({
            qs: {includeUpstreamServices: 'all'},
          })
        );
      });

      it('calls request with the expected properties when includeDetails is specified', async () => {
        setup();

        const registerSpy = sinon.spy(device, 'register');
        device.setEnergyForecastConfig(false);
        device.set('registered', true);

        await device.refresh({includeDetails: CatalogDetails.features});

        assert.calledWith(requestSpy, {
          method: 'PUT',
          uri: 'https://locus-a.wbx2.com/locus/api/v1/devices/88888888-4444-4444-4444-CCCCCCCCCCCC',
          body: sinon.match.any,
          headers: {},
          qs: {includeUpstreamServices: CatalogDetails.features},
        });

        assert.notCalled(registerSpy);
      });

      it('calls register with default includeDetails when not registered', async () => {
        setup();

        const registerSpy = sinon.stub(device, 'register').callsFake(() => Promise.resolve());
        device.setEnergyForecastConfig(false);
        device.set('registered', false);

        await device.refresh();

        assert.calledWith(registerSpy, {});
      });

      it('calls register with default includeDetails when empty options passed', async () => {
        setup();

        const registerSpy = sinon.stub(device, 'register').callsFake(() => Promise.resolve());
        device.setEnergyForecastConfig(false);
        device.set('registered', false);

        await device.refresh({});

        assert.calledWith(registerSpy, {});
      });

      it('calls register with specified includeDetails when not registered', async () => {
        setup();

        const registerSpy = sinon.stub(device, 'register').callsFake(() => Promise.resolve());
        device.setEnergyForecastConfig(false);
        device.set('registered', false);

        await device.refresh({includeDetails: CatalogDetails.websocket});

        assert.calledWith(registerSpy, {includeDetails: CatalogDetails.websocket});
      });

      it('does not process refresh if log out between start and end of request', async () => {
        setup();

        let resolve;

        const requestFn = () => {
          return new Promise((r) => {
            resolve = r;
          });
        };

        device.request.restore();

        sinon.stub(device, 'request').callsFake(requestFn);

        const resultPromise = device.refresh();

        await waitForAsync();

        device.clear();

        resolve({
          body: {
            exampleKey: 'example response value',
          },
        });

        await resultPromise;

        assert.notCalled(device.processRegistrationSuccess);
      });

      it('processes refresh if refresh id does not change', async () => {
        setup();

        let resolve;

        const requestFn = () => {
          return new Promise((r) => {
            resolve = r;
          });
        };

        device.request.restore();

        sinon.stub(device, 'request').callsFake(requestFn);

        const resultPromise = device.refresh();

        await waitForAsync();

        resolve({
          body: {
            exampleKey: 'example response value',
          },
        });

        await resultPromise;

        assert.calledOnce(device.processRegistrationSuccess);
      });
    });

    describe('deleteDevices()', () => {
      const setup = (deviceType) => {
        device.config.defaults = {body: {deviceType}};
      };
      ['WEB', 'WEBCLIENT'].forEach((deviceType) => {
        it(`should delete correct number of devices for ${deviceType}`, async () => {
          setup(deviceType);
          const response = {
            body: {
              devices: [
                {url: 'url3', modificationTime: '2023-10-03T10:00:00Z', deviceType},
                {url: 'url4', modificationTime: '2023-10-04T10:00:00Z', deviceType: 'notweb'},
                {url: 'url1', modificationTime: '2023-10-01T10:00:00Z', deviceType},
                {url: 'url2', modificationTime: '2023-10-02T10:00:00Z', deviceType},
                {url: 'url5', modificationTime: '2023-10-00T10:00:00Z', deviceType},
                {url: 'url6', modificationTime: '2023-09-50T10:00:00Z', deviceType},
                {url: 'url7', modificationTime: '2023-09-30T10:00:00Z', deviceType},
                {url: 'url8', modificationTime: '2023-08-30T10:00:00Z', deviceType},
              ],
            },
          };
          const requestStub = sinon.stub(device, 'request');
          requestStub.withArgs(sinon.match({method: 'GET'})).resolves(response);
          requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

          await device.deleteDevices();

          const expectedDeletions = ['url8', 'url7', 'url1'];

          expectedDeletions.forEach((url) => {
            assert(requestStub.calledWith(sinon.match({uri: url, method: 'DELETE'})));
          });

          const notDeletedUrls = ['url2', 'url3', 'url5', 'url6', 'url4'];
          notDeletedUrls.forEach((url) => {
            assert(requestStub.neverCalledWith(sinon.match({uri: url, method: 'DELETE'})));
          });
        });
      });

      it('does not delete when there are just 2 devices', async () => {
        setup('WEB');
        const response = {
          body: {
            devices: [
              {url: 'url1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'WEB'},
              {url: 'url2', modificationTime: '2023-10-02T10:00:00Z', deviceType: 'WEB'},
            ],
          },
        };

        const requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves(response);
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();
        const notDeletedUrls = ['url1', 'url2'];
        notDeletedUrls.forEach((url) => {
          assert(requestStub.neverCalledWith(sinon.match({uri: url, method: 'DELETE'})));
        });
      });
    });

    describe('#unregister()', () => {
      it('resolves immediately if the device is not registered', async () => {
        const requestSpy = sinon.spy(device, 'request');

        device.set('registered', false);

        await device.unregister();

        assert.notCalled(requestSpy);
      });

      it('clears the device in the event of 404', async () => {
        sinon.stub(device, 'request').rejects({statusCode: 404});

        const clearSpy = sinon.spy(device, 'clear');

        await assert.isRejected(device.unregister());

        assert.calledWith(device.request, {
          uri: 'https://locus-a.wbx2.com/locus/api/v1/devices/88888888-4444-4444-4444-CCCCCCCCCCCC',
          method: 'DELETE',
        });

        assert.calledOnce(clearSpy);
      });

      it('does not clear the device in the event of non 404 failure', async () => {
        sinon.stub(device, 'request').rejects(new Error('some error'));

        const clearSpy = sinon.spy(device, 'clear');

        await assert.isRejected(device.unregister());

        assert.calledWith(device.request, {
          uri: 'https://locus-a.wbx2.com/locus/api/v1/devices/88888888-4444-4444-4444-CCCCCCCCCCCC',
          method: 'DELETE',
        });

        assert.notCalled(clearSpy);
      });
    });

    describe('#register()', () => {
      const setup = (config = {}) => {
        webex.internal.metrics.submitClientMetrics = sinon.stub();

        sinon.stub(device, 'processRegistrationSuccess').callsFake(() => {});

        device.config.defaults = {};
        Object.keys(config).forEach((key) => {
          device.config[key] = config[key];
        });
        device.set('registered', false);
      };

      afterEach(() => {
        sinon.restore();
      });

      it('checks that submitInternalEvent gets called with internal.register.device.request', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        sinon.spy(device, 'request');

        await device.register();

        assert.calledWith(webex.internal.newMetrics.submitInternalEvent, {
          name: 'internal.register.device.request',
        });
      });

      it('calls delete devices when errors with User has excessive device registrations', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const deleteDeviceSpy = sinon
          .stub(device, 'deleteDevices')
          .callsFake(() => Promise.resolve());
        const registerStub = sinon.stub(device, '_registerInternal');

        registerStub
          .onFirstCall()
          .rejects({body: {message: 'User has excessive device registrations'}});
        registerStub
          .onSecondCall()
          .callsFake(() => Promise.resolve({exampleKey: 'example response value'}));

        const result = await device.register();

        assert.calledOnce(deleteDeviceSpy);

        assert.equal(registerStub.callCount, 2);

        assert.deepEqual(result, {exampleKey: 'example response value'});
      });

      it('does not call delete devices when some other error', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const deleteDeviceSpy = sinon
          .stub(device, 'deleteDevices')
          .callsFake(() => Promise.resolve());
        const registerStub = sinon
          .stub(device, '_registerInternal')
          .rejects(new Error('some error'));

        try {
          await device.register({deleteFlag: true});
        } catch (error) {
          assert.notCalled(deleteDeviceSpy);

          assert.equal(registerStub.callCount, 1);

          assert.match(error.message, /some error/, 'Expected error message not matched');
        }
      });

      it('checks that submitInternalEvent gets called with internal.register.device.response on error', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        sinon.stub(device, 'request').rejects(new Error('some error'));

        const result = device.register();

        await assert.isRejected(result);

        assert.calledWith(webex.internal.newMetrics.submitInternalEvent, {
          name: 'internal.register.device.response',
        });
      });

      it('does not process registration if log out between start and end of request', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());

        let resolve;

        const requestFn = () => {
          return new Promise((r) => {
            resolve = r;
          });
        };

        sinon.stub(device, 'request').callsFake(requestFn);

        const resultPromise = device.register();

        await waitForAsync();

        device.clear();

        resolve({
          body: {
            exampleKey: 'example response value',
          },
        });

        await resultPromise;

        assert.notCalled(device.processRegistrationSuccess);
      });

      it('calls process registration if request id matches', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());

        let resolve;

        const requestFn = () => {
          return new Promise((r) => {
            resolve = r;
          });
        };

        sinon.stub(device, 'request').callsFake(requestFn);

        const resultPromise = device.register();

        await waitForAsync();

        resolve({
          body: {
            exampleKey: 'example response value',
          },
        });

        await resultPromise;

        assert.calledOnce(device.processRegistrationSuccess);
      });

      it('checks that submitInternalEvent gets called with internal.register.device.response on success', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());

        sinon.stub(device, 'request').callsFake(() =>
          Promise.resolve({
            exampleKey: 'example response value',
          })
        );

        await device.register();

        assert.calledWith(webex.internal.newMetrics.submitInternalEvent, {
          name: 'internal.register.device.response',
        });
      });

      it('checks that submitInternalEvent not called when canRegister fails', async () => {
        setup();
        sinon.stub(device, 'canRegister').rejects(new Error('some error'));

        const result = device.register();

        await assert.isRejected(result);

        assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
      });

      it('sets the deviceInfo for call diagnostic metrics', async () => {
        setup();
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        sinon.spy(device, 'request');

        await device.register();

        assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.setDeviceInfo, device);
      });

      it('uses the energy forecast config to append upstream services to the outgoing call', async () => {
        setup({energyForecast: true});
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const spy = sinon.spy(device, 'request');
        device.setEnergyForecastConfig(true);

        await device.register();

        assert.calledWith(spy, {
          method: 'POST',
          service: 'wdm',
          resource: 'devices',
          body: {},
          headers: {},
          qs: {includeUpstreamServices: 'all,energyforecast'},
        });
      });

      it('uses the energy forecast config to not append upstream services to the outgoing call', async () => {
        setup({energyForecast: true});
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const spy = sinon.spy(device, 'request');
        device.setEnergyForecastConfig(false);

        await device.register();

        assert.calledWith(spy, {
          method: 'POST',
          service: 'wdm',
          resource: 'devices',
          body: {},
          headers: {},
          qs: {includeUpstreamServices: 'all'},
        });
      });

      it('calls request with the expected properties when includeDetails is specified', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const requestSpy = sinon.spy(device, 'request');
        const refreshSpy = sinon.spy(device, 'refresh');

        device.setEnergyForecastConfig(false);

        await device.register({includeDetails: CatalogDetails.features});

        assert.calledWith(requestSpy, {
          method: 'POST',
          service: 'wdm',
          resource: 'devices',
          body: {},
          headers: {},
          qs: {includeUpstreamServices: CatalogDetails.features},
        });

        assert.notCalled(refreshSpy);
      });

      it('calls request with the expected properties when includeDetails is not specified', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const requestSpy = sinon.spy(device, 'request');
        const refreshSpy = sinon.spy(device, 'refresh');

        device.setEnergyForecastConfig(false);

        await device.register();

        assert.calledWith(requestSpy, {
          method: 'POST',
          service: 'wdm',
          resource: 'devices',
          body: {},
          headers: {},
          qs: {includeUpstreamServices: CatalogDetails.all},
        });

        assert.notCalled(refreshSpy);
      });

      it('calls refresh with default includeDetails when registered', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const refreshSpy = sinon.spy(device, 'refresh');

        device.setEnergyForecastConfig(false);
        device.set('registered', true);

        await device.register();

        assert.calledWith(refreshSpy, {});
      });

      it('calls refresh with specified includeDetails when registered', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        const requestSpy = sinon.spy(device, 'request');
        const refreshSpy = sinon.spy(device, 'refresh');

        device.setEnergyForecastConfig(false);
        device.set('registered', true);

        await device.register({includeDetails: CatalogDetails.websocket});

        assert.calledWith(refreshSpy, {includeDetails: CatalogDetails.websocket});
      });

      it('works when request returns 404 when already registered', async () => {
        setup();

        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());

        const requestStub = sinon.stub(device, 'request');

        requestStub.onFirstCall().rejects({statusCode: 404});
        requestStub.onSecondCall().resolves({some: 'data'});

        device.set('registered', true);

        await device.register();

        assert.calledWith(device.processRegistrationSuccess, {some: 'data'});
      });
    });

    describe('getDebugFeatures()', () => {
      it('returns empty list if debugFeatureTogglesKey is not set', () => {
        assert.isUndefined(device.config.debugFeatureTogglesKey);
        const debugFeatures = device.getDebugFeatures();

        assert.deepEqual(debugFeatures, []);
      });

      it('returns empty list if no debug features in session storage', () => {
        device.config.debugFeatureTogglesKey = 'debug-feature-toggles';
        assert.isUndefined(webex.getWindow().sessionStorage.getItem('debug-feature-toggles'));
        const debugFeatures = device.getDebugFeatures();

        assert.deepEqual(debugFeatures, []);
      });

      it('returns debug features from session storage', () => {
        device.config.debugFeatureTogglesKey = 'debug-feature-toggles';
        webex.getWindow().sessionStorage.setItem(
          'debug-feature-toggles',
          JSON.stringify({
            feature_to_debug_enable: true,
            feature_to_debug_disable: false,
          })
        );
        const debugFeatures = device.getDebugFeatures();

        assert.equal(debugFeatures.length, 2);

        assert.properties(debugFeatures[0], ['key', 'val', 'mutable', 'lastModified']);
        assert.equal(debugFeatures[0].key, 'feature_to_debug_enable');
        assert.equal(debugFeatures[0].val, 'true');
        assert.isTrue(debugFeatures[0].mutable);
        assert.isISODate(debugFeatures[0].lastModified);

        assert.properties(debugFeatures[1], ['key', 'val', 'mutable', 'lastModified']);
        assert.equal(debugFeatures[1].key, 'feature_to_debug_disable');
        assert.equal(debugFeatures[1].val, 'false');
        assert.isTrue(debugFeatures[1].mutable);
        assert.isISODate(debugFeatures[1].lastModified);
      });
    });

    describe('#processRegistrationSuccess()', () => {
      const initialDTOFeatureCounts = {developer: 2, entitlement: 1, user: 1};

      const getClonedDTO = (overrides) => {
        const clonedDTO = cloneDeep(dto);

        clonedDTO.features = {
          developer: [
            {
              key: '1',
              type: 'boolean',
              val: 'true',
              value: true,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z',
            },
            {
              key: 'feature_to_debug_enable',
              type: 'boolean',
              val: 'false',
              value: false,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z',
            },
            {
              key: 'feature_to_debug_disable',
              type: 'boolean',
              val: 'true',
              value: true,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z',
            },
          ],
          entitlement: [
            {
              key: '2',
              val: 'true',
              value: true,
              mutable: false,
            },
          ],
          user: [
            {
              key: '3',
              val: 'true',
              value: true,
              mutable: true,
            },
          ],
          ...overrides,
        };

        return clonedDTO;
      };

      const checkFeatureTypeCounts = (expectedCounts) => {
        Object.entries(expectedCounts).forEach(([type, expectedCount]) => {
          assert.equal(device.features[type].length, expectedCount);
        });
      };

      const checkFeatureNotPresent = (type, key) => {
        assert.isUndefined(device.features[type].get(key));
      };

      const checkFeature = (type, key, expectedValue) => {
        assert.deepEqual(device.features[type].get(key).get('value'), expectedValue);
      };

      it('features are set correctly if etag not in headers, no debug features', () => {
        const clonedDTO = getClonedDTO();

        const response = {
          body: {
            ...clonedDTO,
          },
          headers: {},
        };

        checkFeatureTypeCounts(initialDTOFeatureCounts);
        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('developer', 'feature_to_debug_enable');
        checkFeatureNotPresent('developer', 'feature_to_debug_disable');
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureTypeCounts({developer: 3, entitlement: 1, user: 1});
        checkFeature('developer', '1', true);
        checkFeature('developer', 'feature_to_debug_enable', false);
        checkFeature('developer', 'feature_to_debug_disable', true);
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);
      });

      it('features are set correctly if etag not in headers, debug features in session storage', () => {
        const clonedDTO = getClonedDTO();

        const response = {
          body: {
            ...clonedDTO,
          },
          headers: {},
        };

        device.config.debugFeatureTogglesKey = 'debug-feature-toggles';

        webex.getWindow().sessionStorage.setItem(
          'debug-feature-toggles',
          JSON.stringify({
            feature_to_debug_enable: true,
            feature_to_debug_disable: false,
            feature_debug_only: true,
          })
        );

        checkFeatureTypeCounts(initialDTOFeatureCounts);
        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('developer', 'feature_to_debug_enable');
        checkFeatureNotPresent('developer', 'feature_to_debug_disable');
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureTypeCounts({developer: 4, entitlement: 1, user: 1});
        checkFeature('developer', '1', true);
        checkFeature('developer', 'feature_to_debug_enable', true);
        checkFeature('developer', 'feature_to_debug_disable', false);
        checkFeature('developer', 'feature_debug_only', true);
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);
      });

      it('if the etag matches only the user and entitlement features are updated', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO,
          },
          headers: {
            etag: 'etag-value',
          },
        };

        checkFeatureTypeCounts(initialDTOFeatureCounts);
        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('developer', 'feature_to_debug_enable');
        checkFeatureNotPresent('developer', 'feature_to_debug_disable');
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureTypeCounts(initialDTOFeatureCounts.developer);
        checkFeatureNotPresent('developer', '1');
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the etag is unchanged
        assert.equal(device.get('etag'), 'etag-value');
      });

      it('if the etag matches only the user and entitlement features are updated - check when developer features are set', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO,
          },
          headers: {
            etag: 'etag-value',
          },
        };

        checkFeatureTypeCounts(initialDTOFeatureCounts);
        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('developer', 'feature_to_debug_enable');
        checkFeatureNotPresent('developer', 'feature_to_debug_disable');
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureTypeCounts({
          developer: initialDTOFeatureCounts.developer,
          entitlement: 1,
          user: 1,
        });
        checkFeatureNotPresent('developer', '1');
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the etag is unchanged
        assert.equal(device.get('etag'), 'etag-value');
      });

      it('if the etag does not match all the features are updated', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO,
          },
          headers: {
            etag: 'different-etag-value',
          },
        };

        checkFeatureTypeCounts(initialDTOFeatureCounts);
        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('developer', 'feature_to_debug_enable');
        checkFeatureNotPresent('developer', 'feature_to_debug_disable');
        checkFeatureNotPresent('developer', 'feature_debug_only');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureTypeCounts({developer: 3, entitlement: 1, user: 1});
        checkFeature('developer', '1', true);
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the new etag is set
        assert.equal(device.get('etag'), 'different-etag-value');

        const newClonedDTO = getClonedDTO({
          developer: [
            {
              key: '1',
              type: 'boolean',
              val: 'false',
              value: false,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z',
            },
          ],
          entitlement: [
            {
              key: '2',
              val: 'false',
              value: false,
              mutable: false,
            },
          ],
          user: [
            {
              key: '3',
              val: 'false',
              value: false,
              mutable: true,
            },
          ],
        });

        const newResponse = {
          body: {
            ...newClonedDTO,
          },
          headers: {
            etag: 'different-etag-value',
          },
        };

        device.processRegistrationSuccess(newResponse);

        // only the entitlement and user features should have been changed to false
        checkFeatureTypeCounts({developer: 3, entitlement: 1, user: 1});
        checkFeature('developer', '1', true);
        checkFeature('entitlement', '2', false);
        checkFeature('user', '3', false);
      });
    });
  });
});
