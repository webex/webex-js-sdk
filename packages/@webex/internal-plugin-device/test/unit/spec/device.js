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
      let requestStub;
      let clock;
      let waitForLimitStub;

      const setup = (deviceType) => {
        device.config.defaults = {body: {deviceType}};
      };

      beforeEach(() => {
        waitForLimitStub = sinon.stub(device, '_waitForDeviceCountBelowLimit').resolves();
      });

      afterEach(() => {
        sinon.restore();
        if (clock) {
          clock.restore();
          clock = null;
        }
      });

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

          requestStub = sinon.stub(device, 'request');
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

      it('does not delete when there are only 2 devices (below MIN_DEVICES_FOR_CLEANUP)', async () => {
        setup('WEB');
        const response = {
          body: {
            devices: [
              {url: 'url1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'WEB'},
              {url: 'url2', modificationTime: '2023-10-02T10:00:00Z', deviceType: 'WEB'},
            ],
          },
        };

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves(response);
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();
        // MIN_DEVICES_FOR_CLEANUP = 5; 2 devices is below the threshold, so nothing should be deleted
        assert(requestStub.neverCalledWith(sinon.match({method: 'DELETE'})));
      });

      it('does not delete when device count equals MIN_DEVICES_FOR_CLEANUP (5 devices)', async () => {
        setup('WEB');
        const devices = Array.from({length: 5}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-0${i + 1}T10:00:00Z`,
          deviceType: 'WEB',
        }));

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();
        // MIN_DEVICES_FOR_CLEANUP = 5; exactly at the threshold means no deletion
        assert(requestStub.neverCalledWith(sinon.match({method: 'DELETE'})));
      });

      it('waits for all deletions to complete before proceeding', async () => {
        setup('WEB');
        const devices = Array.from({length: 6}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-0${i}T10:00:00Z`,
          deviceType: 'WEB',
        }));

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});

        const deleteOrder = [];
        requestStub.withArgs(sinon.match({method: 'DELETE'})).callsFake((opts) => {
          deleteOrder.push(opts.uri);
          return Promise.resolve();
        });

        await device.deleteDevices();

        // ceil(6/3) = 2 devices should be deleted
        assert.equal(deleteOrder.length, 2);
      });

      it('does not delete when there are zero devices', async () => {
        setup('WEB');
        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices: []}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();

        assert(requestStub.neverCalledWith(sinon.match({method: 'DELETE'})));
      });

      it('only deletes devices matching the current device type', async () => {
        setup('WEB');
        const devices = [
          {url: 'web1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'WEB'},
          {url: 'web2', modificationTime: '2023-10-02T10:00:00Z', deviceType: 'WEB'},
          {url: 'web3', modificationTime: '2023-10-03T10:00:00Z', deviceType: 'WEB'},
          {url: 'web4', modificationTime: '2023-10-04T10:00:00Z', deviceType: 'WEB'},
          {url: 'web5', modificationTime: '2023-10-05T10:00:00Z', deviceType: 'WEB'},
          {url: 'web6', modificationTime: '2023-10-06T10:00:00Z', deviceType: 'WEB'},
          {url: 'desktop1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'DESKTOP'},
          {url: 'mobile1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'MOBILE'},
        ];

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();

        // Only WEB devices considered: 6 total (> MIN_DEVICES_FOR_CLEANUP=5), ceil(6/3)=2 deleted (oldest: web1, web2)
        assert(requestStub.calledWith(sinon.match({uri: 'web1', method: 'DELETE'})));
        assert(requestStub.calledWith(sinon.match({uri: 'web2', method: 'DELETE'})));
        assert(requestStub.neverCalledWith(sinon.match({uri: 'desktop1', method: 'DELETE'})));
        assert(requestStub.neverCalledWith(sinon.match({uri: 'mobile1', method: 'DELETE'})));
      });

      it('rejects when fetching devices fails', async () => {
        setup('WEB');
        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).rejects(new Error('network error'));

        await assert.isRejected(device.deleteDevices(), 'network error');
      });

      it('resolves when all deletion requests fail (best-effort)', async () => {
        setup('WEB');
        // Use 6 devices (> MIN_DEVICES_FOR_CLEANUP=5) to ensure deletion is attempted
        const devices = [
          {url: 'url1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'WEB'},
          {url: 'url2', modificationTime: '2023-10-02T10:00:00Z', deviceType: 'WEB'},
          {url: 'url3', modificationTime: '2023-10-03T10:00:00Z', deviceType: 'WEB'},
          {url: 'url4', modificationTime: '2023-10-04T10:00:00Z', deviceType: 'WEB'},
          {url: 'url5', modificationTime: '2023-10-05T10:00:00Z', deviceType: 'WEB'},
          {url: 'url6', modificationTime: '2023-10-06T10:00:00Z', deviceType: 'WEB'},
        ];

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).rejects(new Error('delete failed'));

        // Should resolve despite DELETE failures — best-effort cleanup must not block registration retry
        await device.deleteDevices();
        assert.calledWith(device.logger.warn, sinon.match(/deletions failed/));
      });

      it('resolves when only some deletion requests fail (partial failure)', async () => {
        setup('WEB');
        const devices = [
          {url: 'url1', modificationTime: '2023-10-01T10:00:00Z', deviceType: 'WEB'},
          {url: 'url2', modificationTime: '2023-10-02T10:00:00Z', deviceType: 'WEB'},
          {url: 'url3', modificationTime: '2023-10-03T10:00:00Z', deviceType: 'WEB'},
          {url: 'url4', modificationTime: '2023-10-04T10:00:00Z', deviceType: 'WEB'},
          {url: 'url5', modificationTime: '2023-10-05T10:00:00Z', deviceType: 'WEB'},
          {url: 'url6', modificationTime: '2023-10-06T10:00:00Z', deviceType: 'WEB'},
        ];

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        // ceil(6/3) = 2 deletions; first succeeds, second fails
        requestStub
          .withArgs(sinon.match({method: 'DELETE'}))
          .onFirstCall()
          .resolves()
          .onSecondCall()
          .rejects(new Error('404 not found'));

        await device.deleteDevices();
        assert.calledWith(device.logger.warn, sinon.match(/deletions failed/));
      });

      it('calls _waitForDeviceCountBelowLimit with targetCount equal to preCount minus min(5, deletedCount)', async () => {
        setup('WEB');
        const devices = Array.from({length: 20}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          deviceType: 'WEB',
        }));

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();

        // 20 WEB devices, ceil(20/3) = 7 deletions (>= 5), targetCount = 20 - min(5, 7) = 15
        assert.calledWith(waitForLimitStub, 15, 0);
      });

      it('small-n: 6-device case — targetCount is reachable (ceil(6/3)=2 < 5, so wait for 6-2=4)', async () => {
        setup('WEB');
        const devices = Array.from({length: 6}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-0${i + 1}T10:00:00Z`,
          deviceType: 'WEB',
        }));

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();

        // ceil(6/3) = 2 deletions (< 5), targetCount = 6 - min(5, 2) = 4
        // With the old n-5 formula this was 1, which is unreachable and burned all 5 polls
        assert.equal(requestStub.withArgs(sinon.match({method: 'DELETE'})).callCount, 2);
        assert.calledWith(waitForLimitStub, 4, 0);
      });

      it('regression: 144-device case — deleteDevices passes targetCount=139 (144 - min(5, ceil(144/3)))', async () => {
        setup('WEB');
        const devices = Array.from({length: 144}, (_, i) => ({
          url: `url${i}`,
          modificationTime: new Date(Date.UTC(2020, 0, 1, 0, i)).toISOString(),
          deviceType: 'WEB',
        }));

        requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'})).resolves({body: {devices}});
        requestStub.withArgs(sinon.match({method: 'DELETE'})).resolves();

        await device.deleteDevices();

        // ceil(144/3) = 48 deletions (>= 5), targetCount = 144 - min(5, 48) = 139
        assert.equal(requestStub.withArgs(sinon.match({method: 'DELETE'})).callCount, 48);
        assert.calledWith(waitForLimitStub, 139, 0);
      });
    });

    describe('_waitForDeviceCountBelowLimit()', () => {
      let clock;

      const setup = (deviceType) => {
        device.config.defaults = {body: {deviceType}};
      };

      beforeEach(() => {
        clock = sinon.useFakeTimers();
      });

      afterEach(() => {
        sinon.restore();
        clock.restore();
      });

      it('resolves immediately when device count is below the limit on first check', async () => {
        setup('WEB');
        const devices = Array.from({length: 50}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-01T10:00:00Z`,
          deviceType: 'WEB',
        }));

        sinon.stub(device, 'request')
          .withArgs(sinon.match({method: 'GET'}))
          .resolves({body: {devices}});

        const promise = device._waitForDeviceCountBelowLimit(55, 0);
        await clock.tickAsync(3000);
        await promise;
      });

      it('polls multiple times until device count drops below the limit', async () => {
        setup('WEB');
        const makeDevices = (count) =>
          Array.from({length: count}, (_, i) => ({
            url: `url${i}`,
            modificationTime: `2023-10-01T10:00:00Z`,
            deviceType: 'WEB',
          }));

        const requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'}))
          .onFirstCall().resolves({body: {devices: makeDevices(102)}})
          .onSecondCall().resolves({body: {devices: makeDevices(100)}})
          .onThirdCall().resolves({body: {devices: makeDevices(68)}});

        const promise = device._waitForDeviceCountBelowLimit(95, 0);

        // First poll: 102 devices (above target 95), continue polling
        await clock.tickAsync(3000);
        // Second poll: 100 devices (still above target 95), continue polling
        await clock.tickAsync(3000);
        // Third poll: 68 devices (below target 95), resolve
        await clock.tickAsync(3000);

        await promise;

        assert.equal(requestStub.withArgs(sinon.match({method: 'GET'})).callCount, 3);
      });

      it('gives up after max confirmation attempts and resolves anyway', async () => {
        setup('WEB');
        const makeDevices = (count) =>
          Array.from({length: count}, (_, i) => ({
            url: `url${i}`,
            modificationTime: `2023-10-01T10:00:00Z`,
            deviceType: 'WEB',
          }));

        const requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'}))
          .resolves({body: {devices: makeDevices(105)}});

        const promise = device._waitForDeviceCountBelowLimit(100, 0);

        // Tick through all 5 attempts (5 * 3000ms)
        for (let i = 0; i < 5; i += 1) {
          await clock.tickAsync(3000);
        }

        await promise;

        assert(device.logger.warn.calledWith('device: max confirmation attempts reached, proceeding anyway'));
        assert.equal(requestStub.withArgs(sinon.match({method: 'GET'})).callCount, 5);
      });

      it('resolves when count equals exactly 95 (5 below limit)', async () => {
        setup('WEB');
        const devices = Array.from({length: 95}, (_, i) => ({
          url: `url${i}`,
          modificationTime: `2023-10-01T10:00:00Z`,
          deviceType: 'WEB',
        }));

        sinon.stub(device, 'request')
          .withArgs(sinon.match({method: 'GET'}))
          .resolves({body: {devices}});

        const promise = device._waitForDeviceCountBelowLimit(95, 0);
        await clock.tickAsync(3000);
        await promise;
      });

      it('keeps polling when count is above the 5-below-limit threshold', async () => {
        setup('WEB');
        const makeDevices = (count) =>
          Array.from({length: count}, (_, i) => ({
            url: `url${i}`,
            modificationTime: `2023-10-01T10:00:00Z`,
            deviceType: 'WEB',
          }));

        const requestStub = sinon.stub(device, 'request');
        requestStub.withArgs(sinon.match({method: 'GET'}))
          .onFirstCall().resolves({body: {devices: makeDevices(100)}})
          .onSecondCall().resolves({body: {devices: makeDevices(99)}})
          .onThirdCall().resolves({body: {devices: makeDevices(95)}});

        const promise = device._waitForDeviceCountBelowLimit(95, 0);
        // First poll: 100 devices (still over the 95 threshold), continue polling
        await clock.tickAsync(3000);
        // Second poll: 99 devices (still over the 95 threshold), continue polling
        await clock.tickAsync(3000);
        // Third poll: 95 devices (at the safe threshold), resolve
        await clock.tickAsync(3000);
        await promise;

        assert.equal(requestStub.withArgs(sinon.match({method: 'GET'})).callCount, 3);
      });

      it('resolves (best-effort) when the polling GET throws a transient error', async () => {
        setup('WEB');

        sinon.stub(device, 'request')
          .withArgs(sinon.match({method: 'GET'}))
          .rejects(new Error('transient network error'));

        const promise = device._waitForDeviceCountBelowLimit(95, 0);
        await clock.tickAsync(3000);
        await promise;

        assert(device.logger.warn.calledWith(
          sinon.match('device: confirmation check 1 failed, proceeding anyway:')
        ));
      });
    });

    describe('_getDevicesOfCurrentType()', () => {
      const setup = (deviceType) => {
        device.config.defaults = {body: {deviceType}};
      };

      afterEach(() => {
        sinon.restore();
      });

      it('filters devices by the current device type', async () => {
        setup('WEB');
        const allDevices = [
          {url: 'web1', deviceType: 'WEB'},
          {url: 'desktop1', deviceType: 'DESKTOP'},
          {url: 'web2', deviceType: 'WEB'},
          {url: 'mobile1', deviceType: 'MOBILE'},
        ];

        sinon.stub(device, 'request').resolves({body: {devices: allDevices}});

        const result = await device._getDevicesOfCurrentType();

        assert.equal(result.length, 2);
        assert.equal(result[0].url, 'web1');
        assert.equal(result[1].url, 'web2');
      });

      it('returns an empty array when no devices match', async () => {
        setup('WEB');
        const allDevices = [
          {url: 'desktop1', deviceType: 'DESKTOP'},
          {url: 'mobile1', deviceType: 'MOBILE'},
        ];

        sinon.stub(device, 'request').resolves({body: {devices: allDevices}});

        const result = await device._getDevicesOfCurrentType();

        assert.equal(result.length, 0);
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
