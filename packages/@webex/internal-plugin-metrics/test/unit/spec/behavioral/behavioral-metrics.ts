import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {BrowserDetection} from '@webex/common';
import {BehavioralMetrics, config, getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';
import {merge} from 'lodash';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}, navigator: {language: 'language'}};
process.env.NODE_ENV = 'test';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

describe('internal-plugin-metrics', () => {
  describe('BehavioralMetrics', () => {
    let webex;
    let now;
    let behavioralMetrics: BehavioralMetrics;

    const tags = {key: 'val'};

    beforeEach(() => {
      now = new Date();

      webex = {
        canAuthorize: true,
        version: 'webex-version',
        internal: {
          services: {
            get: () => 'locus-url',
          },
          metrics: {
            submitClientMetrics: sinon.stub(),
            config: {...config.metrics},
          },
          newMetrics: {},
          device: {
            userId: 'userId',
            url: 'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/deviceId',
            orgId: 'orgId',
          },
        },
        meetings: {
          config: {
            metrics: {
              clientType: 'TEAMS_CLIENT',
              subClientType: 'WEB_APP',
              clientName: 'Cantina',
            },
          },
          geoHintInfo: {
            clientAddress: '1.3.4.5',
            countryCode: 'UK',
          },
        },
        credentials: {
          isUnverifiedGuest: false,
        },
        prepareFetchOptions: sinon.stub().callsFake((opts: any) => ({...opts, foo: 'bar'})),
        request: sinon.stub().resolves({body: {}}),
        logger: {
          log: sinon.stub(),
          error: sinon.stub(),
        },
      };

      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      behavioralMetrics = new BehavioralMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#getContext', () => {
      it('should build context correctly', () => {
        const res = behavioralMetrics.getContext();

        assert.deepEqual(res, {
          app: {
            version: 'webex-version',
          },
          device: {
            id: 'deviceId',
          },
          locale: 'language',
          os: {
            name: getOSNameInternal(),
            version: getOSVersion(),
          },
        });
      });
    });

    describe('#getDefaultTags', () => {
      it('should build tags correctly', () => {
        const res = behavioralMetrics.getDefaultTags();

        assert.deepEqual(res, {
          browser: getBrowserName(),
          browserHeight: window.innerHeight,
          browserVersion: getBrowserVersion(),
          browserWidth: window.innerWidth,
          domain: window.location.hostname,
          inIframe: false,
          locale: window.navigator.language,
          os: getOSNameInternal(),
        });
      });
    });

    describe('#isReadyToSubmitBehavioralEvents', () => {
      it('should return true when we have a deviceId, false when deviceId is empty or undefined', async () => {
        assert.equal(true, behavioralMetrics.isReadyToSubmitBehavioralEvents());

        webex.internal.device.url = "";
        assert.equal(false, behavioralMetrics.isReadyToSubmitBehavioralEvents());

        delete webex.internal.device.url;
        assert.equal(false, behavioralMetrics.isReadyToSubmitBehavioralEvents());
      });
    });

    describe('#createEventObject', () => {
      it('should build event object correctly', async () => {
        const res = behavioralMetrics.createEventObject({
          product: 'webex',
          agent: 'user',
          target: 'target',
          verb: 'create',
          payload: tags,
        });

        assert.deepEqual(res, {
          context: {
            app: {
              version: 'webex-version',
            },
            device: {
              id: 'deviceId',
            },
            locale: 'language',
            os: {
              name: getOSNameInternal(),
              version: getOSVersion(),
            },
          },
          metricName: 'webex.user.target.create',
          tags: merge(tags, {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            domain: window.location.hostname,
            locale: window.navigator.language,
            os: getOSNameInternal(),
          }),
          timestamp: res.timestamp,
          type: ['behavioral'],
        });
      });
    });
  });
});
