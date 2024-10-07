/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';

// Polyfill for crypto: https://github.com/jsdom/jsdom/issues/1612#issuecomment-663210638
import {Crypto} from '@peculiar/webcrypto';
global.crypto = new Crypto();

import Device from '@webex/internal-plugin-device';
import Mercury from '@webex/internal-plugin-mercury';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import TriggerProxy from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import Meeting, {CallStateForMetrics} from '@webex/plugin-meetings/src/meeting';
import {Services} from '@webex/webex-core';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import Meetings from '@webex/plugin-meetings/src/meetings';
import MeetingCollection from '@webex/plugin-meetings/src/meetings/collection';
import MeetingsUtil from '@webex/plugin-meetings/src/meetings/util';
import PersonalMeetingRoom from '@webex/plugin-meetings/src/personal-meeting-room';
import Reachability from '@webex/plugin-meetings/src/reachability';
import Metrics from '@webex/plugin-meetings/src/metrics';

import testUtils from '../../../utils/testUtils';
import {
  LOCUSEVENT,
  OFFLINE,
  ONLINE,
  ROAP,
  LOCUSINFO,
  EVENT_TRIGGERS,
  DESTINATION_TYPE,
} from '../../../../src/constants';
import CaptchaError from '@webex/plugin-meetings/src/common/errors/captcha-error';
import {forEach} from 'lodash';
import PasswordError from '@webex/plugin-meetings/src/common/errors/password-error';
import PermissionError from '@webex/plugin-meetings/src/common/errors/permission';
import {NoiseReductionEffect, VirtualBackgroundEffect} from '@webex/media-helpers';
import NoMeetingInfoError from '../../../../src/common/errors/no-meeting-info';

describe('plugin-meetings', () => {
  const logger = {
    log: () => {},
    info: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {},
  };

  let triggerProxyStub;

  beforeEach(() => {
    StaticConfig.set({
      bandwidth: {
        audio: 50,
        video: 500,
      },
    });
    LoggerConfig.set({
      verboseEvents: true,
      enable: false,
    });
    triggerProxyStub = sinon.stub(TriggerProxy, 'trigger').returns(true);
  });

  let webex;
  let uuid1;
  let uri1;
  let url1;
  let test1;
  let test2;
  let locusInfo;
  let services;
  let catalog;
  let startReachabilityStub;

  describe('meetings index', () => {
    beforeEach(() => {
      MeetingsUtil.checkH264Support = sinon.stub();
      uuid1 = uuid.v4();
      url1 = `https://example.com/${uuid.v4()}`;
      uri1 = `test-${uuid.v4()}@example.com`;
      test1 = `test-${uuid.v4()}`;
      test2 = `test2-${uuid.v4()}`;
      locusInfo = {
        parse: sinon.stub().returns(true),
        updateMainSessionLocusCache: sinon.stub(),
      };
      webex = new MockWebex({
        children: {
          device: Device,
          mercury: Mercury,
          meetings: Meetings,
          services: Services,
        },
      });

      services = webex.internal.services;
      catalog = services._getCatalog();

      Object.assign(webex, {
        logging: logger,
      });

      Object.assign(webex.meetings.config, {
        bandwidth: {
          // please note, these are the maximum bandwidth values
          // the server supports, minimums have to be tested
          audio: 64000,
          video: 4000000,
          startBitrate: 2000,
        },
        experimental: {
          enableUnifiedMeetings: true,
        },
        logging: {
          enable: true,
          verboseEvents: true,
        },
      });

      Object.assign(webex, {
        logger,
      });

      startReachabilityStub = sinon.stub(webex.meetings, 'startReachability').resolves();

      Object.assign(webex.internal, {
        llm: {on: sinon.stub()},
        device: {
          deviceType: 'FAKE_DEVICE',
          register: sinon.stub().returns(Promise.resolve()),
          unregister: sinon.stub().returns(Promise.resolve()),
        },
        mercury: {
          connect: sinon.stub().returns(Promise.resolve()),
          disconnect: sinon.stub().returns(Promise.resolve()),
          on: () => {},
          off: () => {},
        },
        services: {
          getMeetingPreferences: sinon.stub().returns(
            Promise.resolve({
              sites: [
                {
                  siteUrl: 'site1-example.webex.com',
                  default: false,
                },
                {
                  siteUrl: 'site2-example.webex.com',
                  default: false,
                },
                {
                  siteUrl: 'site3-example.webex.com',
                  default: false,
                },
                {
                  siteUrl: 'go.webex.com',
                  default: true,
                },
              ],
            })
          ),
          _getCatalog: sinon.stub().returns(catalog),
          fetchClientRegionInfo: sinon.stub().returns(Promise.resolve()),
        },
        metrics: {
          submitClientMetrics: sinon.stub().returns(Promise.resolve()),
        },
      });
      webex.emit('ready');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('has a webex instance with a meetings property', () => {
      assert.exists(webex, 'webex was initialized with children');
      assert.exists(webex.meetings, 'meetings child was set up on the webex instance');
    });

    it('has set up the static config copy', () => {
      assert.equal(StaticConfig.meetings.bandwidth.audio, 64000);
      assert.equal(StaticConfig.meetings.bandwidth.video, 4000000);
    });

    it('Should trigger h264 download', () => {
      assert.calledOnce(MeetingsUtil.checkH264Support);
    });

    describe('#startReachability', () => {
      let gatherReachabilitySpy;
      let fakeResult = {id: 'fake-result'};

      beforeEach(() => {
        startReachabilityStub.restore();
        gatherReachabilitySpy = sinon
          .stub(webex.meetings.getReachability(), 'gatherReachability')
          .resolves(fakeResult);
      });

      it('should gather reachability with default trigger value', async () => {
        const result = await webex.meetings.startReachability();

        assert.calledOnceWithExactly(gatherReachabilitySpy, 'client');
        assert.equal(result, fakeResult);
      });

      it('should gather reachability and pass custom trigger value', async () => {
        const trigger = 'custom-trigger';

        const result = await webex.meetings.startReachability(trigger);

        assert.calledOnceWithExactly(gatherReachabilitySpy, trigger);
        assert.equal(result, fakeResult);
      });
    });

    describe('#_toggleUnifiedMeetings', () => {
      it('should have toggleUnifiedMeetings', () => {
        assert.equal(typeof webex.meetings._toggleUnifiedMeetings, 'function');
      });

      describe('success', () => {
        it('should update meeting info to v1', () => {
          webex.meetings._toggleUnifiedMeetings(false);
          assert.equal(webex.meetings.config.experimental.enableUnifiedMeetings, false);
          assert.equal(webex.meetings.meetingInfo.constructor.name, 'MeetingInfo');
        });
      });

      describe('failure', () => {
        it('should not accept non boolean input', () => {
          const currentEnableUnifiedMeetings =
            webex.meetings.config.experimental.enableUnifiedMeetings;

          webex.meetings._toggleUnifiedMeetings('test');
          assert.equal(
            webex.meetings.config.experimental.enableUnifiedMeetings,
            currentEnableUnifiedMeetings
          );
        });
      });
    });

    describe('#_toggleAdhocMeetings', () => {
      it('should have toggleAdhocMeetings', () => {
        assert.equal(typeof webex.meetings._toggleAdhocMeetings, 'function');
      });

      describe('success', () => {
        it('should update meetings to start  adhoc meeting', () => {
          webex.meetings._toggleAdhocMeetings(false);
          assert.equal(webex.meetings.config.experimental.enableAdhocMeetings, false);
        });
      });

      describe('failure', () => {
        it('should not accept non boolean input', () => {
          const currentEnableAdhocMeetings = webex.meetings.config.experimental.enableAdhocMeetings;

          webex.meetings._toggleAdhocMeetings('test');
          assert.equal(
            webex.meetings.config.experimental.enableAdhocMeetings,
            currentEnableAdhocMeetings
          );
        });
      });
    });

    describe('#_toggleTcpReachability', () => {
      it('should have _toggleTcpReachability', () => {
        assert.equal(typeof webex.meetings._toggleTcpReachability, 'function');
      });

      describe('success', () => {
        it('should update meetings to do TCP reachability', () => {
          webex.meetings._toggleTcpReachability(true);
          assert.equal(webex.meetings.config.experimental.enableTcpReachability, true);
        });
      });
    });

    describe('#_toggleTlsReachability', () => {
      it('should have _toggleTlsReachability', () => {
        assert.equal(typeof webex.meetings._toggleTlsReachability, 'function');
      });

      describe('success', () => {
        it('should update meetings to do TLS reachability', () => {
          webex.meetings._toggleTlsReachability(true);
          assert.equal(webex.meetings.config.experimental.enableTlsReachability, true);
        });
      });
    });

    describe('Public API Contracts', () => {
      describe('#register', () => {
        it('emits an event and resolves when register succeeds', async () => {
          webex.canAuthorize = true;
          await webex.meetings.register();
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meetings),
            {file: 'meetings', function: 'register'},
            'meetings:registered'
          );
          assert.isTrue(webex.meetings.registered);
        });

        it('rejects when SDK canAuthorize is false', () => {
          webex.canAuthorize = false;
          assert.isRejected(webex.meetings.register());
        });

        it('rejects when device.register fails', () => {
          webex.canAuthorize = true;
          webex.internal.device.register = sinon.stub().returns(Promise.reject());
          assert.isRejected(webex.meetings.register());
        });

        it('rejects when mercury.connect fails', () => {
          webex.canAuthorize = true;
          webex.internal.mercury.connect = sinon.stub().returns(Promise.reject());
          assert.isRejected(webex.meetings.register());
        });

        it('resolves immediately if already registered', async () => {
          webex.canAuthorize = true;
          webex.meetings.registered = true;
          await webex.meetings.register();
          assert.notCalled(webex.internal.device.register);
          assert.notCalled(webex.internal.mercury.connect);
          assert.isTrue(webex.meetings.registered);
        });

        it('on register makes sure following functions are called ', async () => {
          webex.canAuthorize = true;
          webex.meetings.registered = false;
          await webex.meetings.register();
          assert.called(webex.internal.device.register);
          assert.called(webex.internal.services.getMeetingPreferences);
          assert.called(webex.internal.services.fetchClientRegionInfo);
          assert.called(webex.internal.mercury.connect);
          assert.isTrue(webex.meetings.registered);
        });
      });

      describe('#unregister', () => {
        it('emits an event and resolves when unregister succeeds', (done) => {
          webex.meetings.registered = true;
          webex.meetings.unregister().then(() => {
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meetings),
              {
                file: 'meetings',
                function: 'unregister',
              },
              'meetings:unregistered'
            );
            assert.isFalse(webex.meetings.registered);
            done();
          });
        });

        it('rejects when device.unregister fails', () => {
          webex.meetings.registered = true;
          webex.internal.device.unregister = sinon.stub().returns(Promise.reject());
          assert.isRejected(webex.meetings.unregister());
        });

        it('rejects when mercury.disconnect fails', () => {
          webex.meetings.registered = true;
          webex.internal.mercury.disconnect = sinon.stub().returns(Promise.reject());
          assert.isRejected(webex.meetings.unregister());
        });

        it('resolves immediately if already registered', (done) => {
          webex.meetings.registered = false;
          webex.meetings.unregister().then(() => {
            assert.notCalled(webex.internal.device.register);
            assert.notCalled(webex.internal.mercury.connect);
            assert.isFalse(webex.meetings.registered);
            done();
          });
        });
      });

      describe('virtual background effect', () => {
        beforeEach(() => {
          webex.credentials = {
            supertoken: {
              access_token: 'fake_token',
            },
          };
        });

        it('creates background effect', async () => {
          const result = await webex.meetings.createVirtualBackgroundEffect();

          assert.exists(result);
          assert.instanceOf(result, VirtualBackgroundEffect);
          assert.containsAllKeys(result, ['loadModel', 'isEnabled', 'options']);
          assert.deepEqual(result.options, {
            mode: 'BLUR',
            blurStrength: 'STRONG',
            generator: 'worker',
            quality: 'LOW',
            authToken: 'fake_token',
            mirror: false,
          });
          assert.exists(result.enable);
          assert.exists(result.disable);
          assert.exists(result.dispose);
        });

        it('creates background effect with custom options passed', async () => {
          const effectOptions = {
            generator: 'local',
            frameRate: 45,
            mode: 'IMAGE',
            mirror: false,
            quality: 'HIGH',
            blurStrength: 'STRONG',
            bgImageUrl: 'https://test.webex.com/landscape.5a535788.jpg',
          };

          const result = await webex.meetings.createVirtualBackgroundEffect(effectOptions);

          assert.exists(result);
          assert.instanceOf(result, VirtualBackgroundEffect);
          assert.containsAllKeys(result, ['loadModel', 'isEnabled', 'options']);
          assert.deepEqual(result.options, {...effectOptions, authToken: 'fake_token'});
          assert.exists(result.enable);
          assert.exists(result.disable);
          assert.exists(result.dispose);
        });
      });

      describe('noise reduction effect', () => {
        beforeEach(() => {
          webex.credentials = {
            supertoken: {
              access_token: 'fake_token',
            },
          };
        });

        it('creates noise reduction effect', async () => {
          const result = await webex.meetings.createNoiseReductionEffect({audioContext: {}});

          assert.exists(result);
          assert.instanceOf(result, NoiseReductionEffect);
          assert.containsAllKeys(result, ['audioContext', 'isEnabled', 'isReady', 'options']);
          assert.equal(result.options.authToken, 'fake_token');
          assert.deepEqual(result.options, {
            audioContext: {},
            authToken: 'fake_token',
            mode: 'WORKLET',
            env: 'prod',
            avoidSimd: false,
          });
          assert.exists(result.enable);
          assert.exists(result.disable);
          assert.exists(result.dispose);
        });

        it('creates noise reduction effect with custom options passed', async () => {
          const effectOptions = {
            audioContext: {},
            mode: 'LEGACY',
            env: 'int',
            avoidSimd: true,
          };

          const result = await webex.meetings.createNoiseReductionEffect(effectOptions);

          assert.exists(result);
          assert.instanceOf(result, NoiseReductionEffect);
          assert.containsAllKeys(result, ['audioContext', 'isEnabled', 'isReady', 'options']);
          assert.deepEqual(result.options, {...effectOptions, authToken: 'fake_token'});
          assert.exists(result.enable);
          assert.exists(result.disable);
          assert.exists(result.dispose);
        });
      });

      describe('gets', () => {
        describe('#getReachability', () => {
          it('should have #getReachability', () => {
            assert.exists(webex.meetings.getReachability);
          });
          it('gets the reachability data instance from webex.meetings', () => {
            const reachability = webex.meetings.getReachability();

            assert.exists(reachability, 'reachability is defined');
            assert.instanceOf(reachability, Reachability, 'should be a reachability instance');
          });
        });
        describe('#getPersonalMeetingRoom', () => {
          it('should have #getPersonalMeetingRoom', () => {
            assert.exists(webex.meetings.getPersonalMeetingRoom);
          });
          it('gets the personal meeting room instance from webex.meetings', () => {
            const personalMeetingRoom = webex.meetings.getPersonalMeetingRoom();

            assert.exists(
              personalMeetingRoom,
              'personal meeting room instance is set up at object creation'
            );
            assert.instanceOf(
              personalMeetingRoom,
              PersonalMeetingRoom,
              'should be a personal meeting room instance'
            );
          });
        });
        describe('Static shortcut proxy methods', () => {
          describe('MeetingCollection getByKey proxies', () => {
            beforeEach(() => {
              webex.meetings.meetingCollection.getByKey = sinon.stub().returns(true);
            });
            it('should have #getMeetingByType', () => {
              assert.exists(webex.meetings.getMeetingByType);
            });
            describe('#getMeetingByType', () => {
              it('gets the Meeting instance from MeetingCollection using type and value', () => {
                webex.meetings.getMeetingByType(test1, test2);
                assert.calledOnce(webex.meetings.meetingCollection.getByKey);
                assert.calledWith(webex.meetings.meetingCollection.getByKey, test1, test2);
              });
            });
          });
          describe('MeetingCollection getAll proxies', () => {
            beforeEach(() => {
              webex.meetings.meetingCollection.getAll = sinon.stub().returns(true);
            });
            it('should have #getAllMeetings', () => {
              assert.exists(webex.meetings.getAllMeetings);
            });
            describe('#getAllMeetings', () => {
              it('calls MeetingCollection to get all meetings with supplied options', () => {
                webex.meetings.getAllMeetings();
                assert.calledOnce(webex.meetings.meetingCollection.getAll);
              });
            });
          });
        });
      });
      describe('#syncMeetings', () => {
        it('should have #syncMeetings', () => {
          assert.exists(webex.meetings.syncMeetings);
        });
        it('should do nothing and return a resolved promise if unverified guest', async () => {
          webex.meetings.request.getActiveMeetings = sinon.stub().returns(
            Promise.resolve({
              loci: [
                {
                  url: url1,
                },
              ],
            })
          );
          webex.credentials.isUnverifiedGuest = true;
          LoggerProxy.logger.info = sinon.stub();

          await webex.meetings.syncMeetings();

          assert.notCalled(webex.meetings.request.getActiveMeetings);
          assert.calledWith(
            LoggerProxy.logger.info,
            'Meetings:index#syncMeetings --> skipping meeting sync as unverified guest'
          );
        });
        describe('succesful requests', () => {
          beforeEach(() => {
            webex.meetings.request.getActiveMeetings = sinon.stub().returns(
              Promise.resolve({
                loci: [
                  {
                    url: url1,
                  },
                ],
              })
            );
          });
          describe('when meeting is returned', () => {
            beforeEach(() => {
              webex.meetings.meetingCollection.getByKey = sinon.stub().returns({
                locusInfo,
              });
            });
            it('tests the sync meeting calls for existing meeting', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(webex.meetings.meetingCollection.getByKey);
              assert.calledOnce(locusInfo.parse);
              assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            });
          });
          describe('when meeting is not returned', () => {
            let initialSetup;

            beforeEach(() => {
              initialSetup = sinon.stub().returns(true);
              webex.meetings.meetingCollection.getByKey = sinon.stub().returns(null);
              webex.meetings.create = sinon.stub().returns(
                Promise.resolve({
                  locusInfo: {
                    ...locusInfo,
                    initialSetup,
                  },
                })
              );
            });
            it('tests the sync meeting calls for not existing meeting', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
              assert.calledOnce(initialSetup);
              assert.calledOnce(webex.meetings.create);
              assert.calledWith(webex.meetings.request.getActiveMeetings);
              assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
              assert.calledWith(
                webex.meetings.create,
                {
                  url: url1,
                },
                'LOCUS_ID'
              );
              assert.calledWith(initialSetup, {
                url: url1,
              });
            });
          });
          describe('when destroying meeting is needed', () => {
            let destroySpy;
            let cleanUpSpy;

            const meetingCollectionMeetings = {
              stillValidLocusMeeting: {
                locusUrl: 'still-valid-locus-url',
                sendCallAnalyzerMetrics: sinon.stub(),
              },
              noLongerValidLocusMeeting: {
                locusUrl: 'no-longer-valid-locus-url',
                sendCallAnalyzerMetrics: sinon.stub(),
              },
              otherNonLocusMeeting1: {
                locusUrl: null,
                sendCallAnalyzerMetrics: sinon.stub(),
              },
              otherNonLocusMeeting2: {
                locusUrl: undefined,
                sendCallAnalyzerMetrics: sinon.stub(),
              },
            };

            beforeEach(() => {
              destroySpy = sinon.spy(webex.meetings, 'destroy');
              webex.meetings.meetingCollection.getAll = sinon
                .stub()
                .returns(meetingCollectionMeetings);
              webex.meetings.request.getActiveMeetings = sinon.stub().returns(
                Promise.resolve({
                  loci: [{url: 'still-valid-locus-url'}],
                })
              );
              cleanUpSpy = sinon.stub(MeetingUtil, 'cleanUp').returns(Promise.resolve());
            });

            afterEach(() => {
              cleanUpSpy.restore();
            });

            it('destroy any meeting that has no active locus url if keepOnlyLocusMeetings is not defined', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(webex.meetings.meetingCollection.getAll);
              assert.calledWith(destroySpy, meetingCollectionMeetings.noLongerValidLocusMeeting);
              assert.calledWith(destroySpy, meetingCollectionMeetings.otherNonLocusMeeting1);
              assert.calledWith(destroySpy, meetingCollectionMeetings.otherNonLocusMeeting2);
              assert.callCount(destroySpy, 3);

              assert.callCount(MeetingUtil.cleanUp, 3);
            });

            it('destroy any meeting that has no active locus url if keepOnlyLocusMeetings === true', async () => {
              await webex.meetings.syncMeetings({keepOnlyLocusMeetings: true});
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(webex.meetings.meetingCollection.getAll);
              assert.calledWith(destroySpy, meetingCollectionMeetings.noLongerValidLocusMeeting);
              assert.calledWith(destroySpy, meetingCollectionMeetings.otherNonLocusMeeting1);
              assert.calledWith(destroySpy, meetingCollectionMeetings.otherNonLocusMeeting2);
              assert.callCount(destroySpy, 3);

              assert.callCount(MeetingUtil.cleanUp, 3);
            });

            it('destroy any LOCUS meetings that have no active locus url if keepOnlyLocusMeetings === false', async () => {
              await webex.meetings.syncMeetings({keepOnlyLocusMeetings: false});
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(webex.meetings.meetingCollection.getAll);
              assert.calledWith(destroySpy, meetingCollectionMeetings.noLongerValidLocusMeeting);
              assert.callCount(destroySpy, 1);

              assert.calledOnce(MeetingUtil.cleanUp);
            });
          });
        });
      });
      describe('#create', () => {
        let infoOptions;

        it('should have #create', () => {
          assert.exists(webex.meetings.create);
        });
        beforeEach(() => {
          infoOptions = {
            destination: 'dest-example',
            type: 'CONVERSATION_URL',
          };
          webex.meetings.meetingCollection.getByKey = sinon.stub().returns();
          webex.meetings.createMeeting = sinon.stub().returns(
            Promise.resolve({
              on: () => true,
            })
          );
        });

        it('should call MeetingInfo#fetchInfoOptions() with proper params', () => {
          webex.meetings.meetingInfo.fetchInfoOptions = sinon.stub().resolves(infoOptions);

          return webex.meetings.create(infoOptions.destination, infoOptions.type).then(() => {
            assert.calledWith(
              webex.meetings.meetingInfo.fetchInfoOptions,
              infoOptions.destination,
              infoOptions.type
            );

            assert.calledTwice(webex.meetings.meetingCollection.getByKey);
          });
        });

        const FAKE_USE_RANDOM_DELAY = true;
        const correlationId = 'my-correlationId';
        const sessionCorrelationId = 'my-session-correlationId';
        const callStateForMetrics = {
          sessionCorrelationId: 'my-session-correlationId2',
          correlationId: 'my-correlationId2',
          joinTrigger: 'my-join-trigger',
          loginType: 'my-login-type',
        };

        it('should call setCallStateForMetrics on any pre-existing meeting', async () => {
          const fakeMeeting = {setCallStateForMetrics: sinon.mock()};
          webex.meetings.meetingCollection.getByKey = sinon.stub().returns(fakeMeeting);
          await webex.meetings.create(
            test1,
            test2,
            FAKE_USE_RANDOM_DELAY,
            {},
            correlationId,
            true,
            callStateForMetrics,
            undefined,
            undefined,
            sessionCorrelationId
          );
          assert.calledOnceWithExactly(fakeMeeting.setCallStateForMetrics, {
            ...callStateForMetrics,
            correlationId,
            sessionCorrelationId,
          });
        });

        const checkCallCreateMeeting = async (createParameters, createMeetingParameters) => {
          const create = webex.meetings.create(...createParameters);

          assert.exists(create.then);
          await create;
          assert.calledOnce(webex.meetings.createMeeting);
          assert.calledWith(webex.meetings.createMeeting, ...createMeetingParameters);
        };

        it('calls createMeeting and returns its promise', async () => {
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, correlationId, true],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, {correlationId}, true]
          );
        });

        it('calls createMeeting, pass the meeting info param and returns its promise', async () => {
          const meetingInfo = {};
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, correlationId, true, undefined, meetingInfo],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, {correlationId}, true, meetingInfo]
          );
        });

        it('calls createMeeting, pass the meeting info and meetingLookupURL param and returns its promise', async () => {
          const meetingInfo = {};
          await checkCallCreateMeeting(
            [
              test1,
              test2,
              FAKE_USE_RANDOM_DELAY,
              {},
              correlationId,
              true,
              undefined,
              meetingInfo,
              'meetingLookupURL',
              sessionCorrelationId
            ],
            [
              test1,
              test2,
              FAKE_USE_RANDOM_DELAY,
              {},
              {correlationId, sessionCorrelationId},
              true,
              meetingInfo,
              'meetingLookupURL',
            ]
          );
        });

        it('calls createMeeting when failOnMissingMeetinginfo is undefined and returns its promise', async () => {
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, correlationId, undefined],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, {correlationId}, false]
          );
        });

        it('calls createMeeting when failOnMissingMeetinginfo is false and returns its promise', async () => {
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, correlationId, false],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, {correlationId}, false]
          );
        });

        it('calls createMeeting with callStateForMetrics and returns its promise', async () => {
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, undefined, true, callStateForMetrics],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, callStateForMetrics, true]
          );
        });

        it('calls createMeeting with callStateForMetrics overwritten with correlationId and returns its promise', async () => {
          await checkCallCreateMeeting(
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, correlationId, true, callStateForMetrics],
            [test1, test2, FAKE_USE_RANDOM_DELAY, {}, {...callStateForMetrics, correlationId}, true]
          );
        });

        it('calls createMeeting with extra info params and returns its promise', async () => {
          const FAKE_USE_RANDOM_DELAY = false;
          const correlationId = 'my-correlationId';

          const FAKE_INFO_EXTRA_PARAMS = {
            mtid: 'm9fe0afd8c435e892afcce9ea25b97046',
            joinTXId: 'TSmrX61wNF',
          };
          const create = webex.meetings.create(
            test1,
            test2,
            FAKE_USE_RANDOM_DELAY,
            FAKE_INFO_EXTRA_PARAMS,
            correlationId
          );

          assert.exists(create.then);
          await create;
          assert.calledOnce(webex.meetings.createMeeting);
          assert.calledWith(
            webex.meetings.createMeeting,
            test1,
            test2,
            FAKE_USE_RANDOM_DELAY,
            FAKE_INFO_EXTRA_PARAMS,
            {correlationId},
            false
          );
        });

        it('creates a new meeting when a scheduled meeting exists in the conversation', async () => {
          const conversationId = '3b1ce9a0-777d-11eb-ba2e-b9fd98c6d469';
          const conversationUrl = `https://conv-a.wbx2.com/conversation/api/v1/conversations/${conversationId}`;
          const correlationId = uuid.v4();
          const scheduledMeetingFixture = {
            conversationId,
            conversationUrl,
            correlationId,
            id: correlationId,
            locusInfo: {
              scheduledMeeting: true,
            },
          };

          infoOptions.destination = conversationUrl;
          infoOptions.locusInfo = {
            scheduledMeeting: true,
          };

          webex.meetings.meetingCollection.getByKey = sinon.stub().callsFake((type) => {
            if (type === 'conversationUrl') {
              return infoOptions;
            }

            return undefined;
          });

          webex.meetings.meetingInfo.fetchInfoOptions = sinon
            .stub()
            .resolves(scheduledMeetingFixture);

          webex.meetings.meetingCollection.set(scheduledMeetingFixture);

          await webex.meetings.create(conversationUrl, infoOptions.type);

          assert.calledOnce(webex.meetings.createMeeting);
          assert.calledWith(webex.meetings.createMeeting, conversationUrl, infoOptions.type);
        });
      });
    });
    describe('Private Detailed API and Helpers', () => {
      describe('#listenForEvents', () => {
        beforeEach(() => {
          webex.meetings.handleLocusMercury = sinon.stub().returns(true);
          webex.internal.mercury.on = sinon.stub().returns((type, callback) => {
            callback();
          });
        });
        it('Should register for mercury events', () => {
          webex.meetings.listenForEvents();
          assert.calledWith(webex.internal.mercury.on, LOCUSEVENT.LOCUS_MERCURY);
          assert.calledWith(webex.internal.mercury.on, ONLINE);
          assert.calledWith(webex.internal.mercury.on, ROAP.ROAP_MERCURY);
          assert.calledWith(webex.internal.mercury.on, OFFLINE);
          assert.callCount(webex.internal.mercury.on, 4);
        });
      });
      describe('#handleLocusMercury', () => {
        beforeEach(() => {
          webex.meetings.handleLocusEvent = sinon.stub().returns(true);
        });
        it('doesnt call handle locus mercury for a locus roap event', () => {
          webex.meetings.handleLocusMercury({
            data: {
              eventType: 'locus.message.roap',
            },
          });
          assert.notCalled(webex.meetings.handleLocusEvent);
        });
        it('doesnt call handle locus mercury for an undefined eventType', () => {
          webex.meetings.handleLocusMercury({
            data: {},
          });
          assert.notCalled(webex.meetings.handleLocusEvent);
        });
        it('calls handle locus mercury for all locus events', () => {
          webex.meetings.handleLocusMercury({
            data: {
              eventType: test1,
            },
          });
          assert.calledOnce(webex.meetings.handleLocusEvent);
          assert.calledWith(
            webex.meetings.handleLocusEvent,
            {
              eventType: test1,
            },
            true
          );
        });
      });
      describe('#handleLocusEvent', () => {
        describe('there was a meeting', () => {
          beforeEach(() => {
            webex.meetings.meetingCollection.getByKey = sinon.stub().returns({
              locusInfo,
            });
          });
          it('should parse the meeting info and update main session locus cache', () => {
            sinon.stub(MeetingsUtil, 'isBreakoutLocusDTO').returns(false);
            webex.meetings.handleLocusEvent({
              locusUrl: url1,
            });
            assert.calledOnce(webex.meetings.meetingCollection.getByKey);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledOnce(locusInfo.parse);
            assert.calledOnce(locusInfo.updateMainSessionLocusCache);
            assert.calledWith(
              locusInfo.parse,
              {
                locusInfo,
              },
              {
                locusUrl: url1,
              }
            );
          });

          it('should not update main session locus cache', () => {
            sinon.stub(MeetingsUtil, 'isBreakoutLocusDTO').returns(true);
            webex.meetings.handleLocusEvent({
              locusUrl: url1,
            });
            assert.notCalled(locusInfo.updateMainSessionLocusCache);
          });
        });
        describe('there was not a meeting', () => {
          let initialSetup;
          const webExMeetingId = '123456';

          beforeEach(() => {
            initialSetup = sinon.stub().returns(true);
            webex.meetings.meetingCollection.getByKey = sinon.stub().returns(undefined);
            webex.meetings.create = sinon.stub().returns(
              Promise.resolve({
                id: 'meeting-id',
                locusInfo: {
                  ...locusInfo,
                  initialSetup,
                },
              })
            );
          });
          it('should setup the meeting by difference event', async () => {
            await webex.meetings.handleLocusEvent({
              locus: {
                id: uuid1,
                replaces: [
                  {
                    locusUrl: 'http:locusUrl',
                  },
                ],
                self: {
                  callBackInfo: {
                    callbackAddress: uri1,
                  },
                  devices: [],
                },
                info: {
                  webExMeetingId,
                },
              },
              eventType: 'locus.difference',
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 6);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledWith(
              webex.meetings.meetingCollection.getByKey,
              'meetingNumber',
              webExMeetingId
            );
            assert.calledOnce(initialSetup);
            assert.calledWith(initialSetup, {
              id: uuid1,
              replaces: [
                {
                  locusUrl: 'http:locusUrl',
                },
              ],
              self: {
                callBackInfo: {
                  callbackAddress: uri1,
                },
                devices: [],
              },
              info: {
                webExMeetingId,
              },
            });
          });
          it('should setup the meeting by difference event without replaces', async () => {
            await webex.meetings.handleLocusEvent({
              locus: {
                id: uuid1,
                self: {
                  callBackInfo: {
                    callbackAddress: uri1,
                  },
                  devices: [],
                },
                info: {
                  webExMeetingId,
                },
              },
              eventType: 'locus.difference',
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledWith(
              webex.meetings.meetingCollection.getByKey,
              'meetingNumber',
              webExMeetingId
            );
            assert.calledOnce(initialSetup);
            assert.calledWith(initialSetup, {
              id: uuid1,
              self: {
                callBackInfo: {
                  callbackAddress: uri1,
                },
                devices: [],
              },
              info: {
                webExMeetingId,
              },
            });
          });

          it('sends client event correctly on finally', async () => {
            webex.meetings.getMeetingByType = sinon.stub().returns(true);

            await webex.meetings.handleLocusEvent({
              locus: {
                id: uuid1,
                self: {
                  callBackInfo: {
                    callbackAddress: uri1,
                  },
                  devices: [],
                },
                info: {
                  webExMeetingId,
                },
              },
              eventType: 'locus.difference',
              locusUrl: url1,
            });

            await testUtils.flushPromises();

            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.remote-started',
              payload: {
                trigger: 'mercury-event',
              },
              options: {
                meetingId: 'meeting-id',
              },
            });
          });

          it('should setup the meeting by a not difference event', async () => {
            await webex.meetings.handleLocusEvent({
              locus: {
                id: uuid1,
                self: {
                  callBackInfo: {
                    callbackAddress: uri1,
                  },
                  devices: [],
                },
                info: {
                  webExMeetingId,
                },
              },
              eventType: test1,
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledWith(
              webex.meetings.meetingCollection.getByKey,
              'meetingNumber',
              webExMeetingId
            );
            assert.calledOnce(initialSetup);
            assert.calledWith(initialSetup, {
              id: uuid1,
              self: {
                callBackInfo: {
                  callbackAddress: uri1,
                },
                devices: [],
              },
              info: {
                webExMeetingId,
              },
            });
          });

          const generateFakeLocusData = (isUnifiedSpaceMeeting) => ({
            locus: {
              id: uuid1,
              self: {
                callbackInfo: {
                  callbackAddress: uri1,
                },
                devices: [],
              },
              info: {
                isUnifiedSpaceMeeting,
              },
              conversationUrl: 'fakeConvoUrl',
            },
            eventType: test1,
            locusUrl: url1,
          });

          it('should not try to match USM meetings by conversation url', async () => {
            await webex.meetings.handleLocusEvent(generateFakeLocusData(true));
            assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(0).args, [
              'locusUrl',
              url1,
            ]);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(1).args, [
              'correlationId',
              false,
            ]);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(2).args, [
              'sipUri',
              uri1,
            ]);
            assert.calledOnce(initialSetup);
          });
          it('should try to match non-USM meetings by conversation url', async () => {
            await webex.meetings.handleLocusEvent(generateFakeLocusData(false));
            assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(0).args, [
              'locusUrl',
              url1,
            ]);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(1).args, [
              'correlationId',
              false,
            ]);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(2).args, [
              'sipUri',
              uri1,
            ]);
            assert.deepEqual(webex.meetings.meetingCollection.getByKey.getCall(3).args, [
              'conversationUrl',
              'fakeConvoUrl',
            ]);
            assert.calledOnce(initialSetup);
          });
        });
      });
      describe('#createMeeting', () => {
        beforeEach(() => {
          webex.internal.device.userId = uuid1;
          webex.internal.device.url = url1;
          MeetingCollection.set = sinon.stub().returns(true);
          MeetingsUtil.getMeetingAddedType = sinon.stub().returns('test meeting added type');
          TriggerProxy.trigger.reset();
        });
        describe('successful MeetingInfo.#fetchMeetingInfo', () => {
          let clock, setTimeoutSpy, fakeMeetingStartTimeString, FAKE_TIME_TO_START;
          const FAKE_INFO_EXTRA_PARAMS = {
            mtid: 'm9fe0afd8c435e892afcce9ea25b97046',
            joinTXId: 'TSmrX61wNF',
          };

          beforeEach(() => {
            clock = sinon.useFakeTimers();
            setTimeoutSpy = sinon.spy(clock, 'setTimeout');
            webex.meetings.meetingInfo.fetchMeetingInfo = sinon.stub().returns(
              Promise.resolve({
                body: {
                  permissionToken:
                    'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
                  meetingJoinUrl: 'meetingJoinUrl',
                },
              })
            );
            const nowTimeStamp = Date.now();

            FAKE_TIME_TO_START = 0.1 * 60 * 1000;
            const fakeMeetingStartTimeStamp = nowTimeStamp + FAKE_TIME_TO_START;
            const fakeMeetingStartTimeDate = new Date(fakeMeetingStartTimeStamp);

            fakeMeetingStartTimeString = fakeMeetingStartTimeDate.toISOString();
          });

          afterEach(() => {
            clock.restore();
          });

          const checkCreateWithoutDelay = (
            meeting,
            destination,
            type,
            extraParams = {},
            expectedMeetingData = {},
            sendCAevents = false,
            injectMeetingInfo = false
          ) => {
            if (injectMeetingInfo) {
              assert.notCalled(webex.meetings.meetingInfo.fetchMeetingInfo);
            } else {
              assert.calledOnce(webex.meetings.meetingInfo.fetchMeetingInfo);
            }

            assert.calledOnce(MeetingsUtil.getMeetingAddedType);
            assert.notCalled(setTimeoutSpy);
            assert.callCount(TriggerProxy.trigger, 5);

            if (injectMeetingInfo) {
              assert.notCalled(webex.meetings.meetingInfo.fetchMeetingInfo);
            } else {
              assert.calledWith(
                webex.meetings.meetingInfo.fetchMeetingInfo,
                destination,
                type,
                null,
                null,
                undefined,
                undefined,
                extraParams,
                {meetingId: meeting.id, sendCAevents}
              );
            }

            assert.calledWith(MeetingsUtil.getMeetingAddedType, 'test type');

            if (expectedMeetingData.permissionToken) {
              assert.equal(meeting.permissionToken, expectedMeetingData.permissionToken);
            }
            if (expectedMeetingData.meetingJoinUrl) {
              assert.equal(meeting.meetingJoinUrl, expectedMeetingData.meetingJoinUrl);
            }
            if (expectedMeetingData.correlationId) {
              assert.equal(meeting.correlationId, expectedMeetingData.correlationId);
            }
            if (expectedMeetingData.callStateForMetrics) {
              assert.deepEqual(
                meeting.callStateForMetrics,
                expectedMeetingData.callStateForMetrics
              );
            }
            if (expectedMeetingData.meetingLookupUrl) {
              assert.equal(
                meeting.meetingInfo.meetingLookupUrl,
                expectedMeetingData.meetingLookupUrl
              );
            }
            assert.equal(meeting.destination, destination);
            assert.equal(meeting.destinationType, type);
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meetings),
              {
                file: 'meetings',
                function: 'createMeeting',
              },
              'meeting:added',
              {
                meeting: sinon.match.instanceOf(Meeting),
                type: 'test meeting added type',
              }
            );
            assert.calledWith(
              TriggerProxy.trigger,
              meeting,
              {file: 'meetings', function: 'fetchMeetingInfo'},
              'meeting:meetingInfoAvailable'
            );
          };

          it('creates the meeting from a successful meeting info fetch promise testing', async () => {
            const meeting = await webex.meetings.createMeeting('test destination', 'test type');

            const expectedMeetingData = {
              permissionToken:
                'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
              meetingJoinUrl: 'meetingJoinUrl',
              correlationId: meeting.id,
            };

            checkCreateWithoutDelay(
              meeting,
              'test destination',
              'test type',
              {},
              expectedMeetingData
            );
          });

          it('accepts injected meeting info', async () => {
            const meetingInfo = {
              permissionToken:
                'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
              meetingJoinUrl: 'meetingJoinUrl',
            };

            const meeting = await webex.meetings.createMeeting(
              'test destination',
              'test type',
              false,
              {},
              undefined,
              false,
              meetingInfo
            );

            const expectedMeetingData = {
              ...meetingInfo,
              correlationId: meeting.id,
            };

            checkCreateWithoutDelay(
              meeting,
              'test destination',
              'test type',
              {},
              expectedMeetingData,
              false,
              true
            );
          });

          it('accepts injected meeting info with meeting lookup url', async () => {
            const meetingInfo = {
              permissionToken:
                'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
              meetingJoinUrl: 'meetingJoinUrl',
            };

            const meeting = await webex.meetings.createMeeting(
              'test destination',
              'test type',
              false,
              {},
              undefined,
              false,
              meetingInfo,
              'meetingLookupUrl'
            );

            const expectedMeetingData = {
              ...meetingInfo,
              meetingLookupUrl: 'meetingLookupUrl',
              correlationId: meeting.id,
            };

            checkCreateWithoutDelay(
              meeting,
              'test destination',
              'test type',
              {},
              expectedMeetingData,
              false,
              true
            );
          });

          [undefined, FAKE_INFO_EXTRA_PARAMS].forEach((infoExtraParams) => {
            const infoExtraParamsProvided = infoExtraParams !== undefined;

            it(`creates the meeting from a successful meeting info fetch meeting resolve testing${
              infoExtraParamsProvided ? ' with infoExtraParams' : ''
            }`, async () => {
              const meeting = await webex.meetings.createMeeting(
                'test destination',
                'test type',
                false,
                infoExtraParams
              );
              const expectedMeetingData = {
                permissionToken:
                  'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
                meetingJoinUrl: 'meetingJoinUrl',
              };

              assert.instanceOf(
                meeting,
                Meeting,
                'createMeeting should eventually resolve to a Meeting Object'
              );
              checkCreateWithoutDelay(
                meeting,
                'test destination',
                'test type',
                infoExtraParamsProvided ? infoExtraParams : {},
                expectedMeetingData
              );
            });

            it(`creates the meeting from a successful meeting info fetch with random delay${
              infoExtraParamsProvided ? ' with infoExtraParams' : ''
            }`, async () => {
              const FAKE_LOCUS_MEETING = {
                conversationUrl: 'locusConvURL',
                url: 'locusUrl',
                info: {
                  webExMeetingId: 'locusMeetingId',
                  sipUri: 'locusSipUri',
                  owner: 'locusOwner',
                },
                meeting: {
                  startTime: fakeMeetingStartTimeString,
                },
                fullState: {
                  active: false,
                },
              };

              const meeting = await webex.meetings.createMeeting(
                FAKE_LOCUS_MEETING,
                'test type',
                true,
                infoExtraParams
              );

              assert.instanceOf(
                meeting,
                Meeting,
                'createMeeting should eventually resolve to a Meeting Object'
              );
              assert.notCalled(webex.meetings.meetingInfo.fetchMeetingInfo);
              assert.calledOnce(setTimeoutSpy);

              // Parse meeting info with locus object
              assert.equal(meeting.conversationUrl, 'locusConvURL');
              assert.equal(meeting.locusUrl, 'locusUrl');
              assert.equal(meeting.sipUri, 'locusSipUri');
              assert.equal(meeting.meetingNumber, 'locusMeetingId');
              assert.isUndefined(meeting.meetingJoinUrl);
              assert.equal(meeting.owner, 'locusOwner');
              assert.isUndefined(meeting.permissionToken);

              // Add meeting and send trigger
              assert.calledWith(MeetingsUtil.getMeetingAddedType, 'test type');
              assert.calledTwice(TriggerProxy.trigger);
              assert.calledWith(
                TriggerProxy.trigger,
                sinon.match.instanceOf(Meetings),
                {
                  file: 'meetings',
                  function: 'createMeeting',
                },
                'meeting:added',
                {
                  meeting: sinon.match.instanceOf(Meeting),
                  type: 'test meeting added type',
                }
              );

              // When timer expires
              clock.tick(FAKE_TIME_TO_START);
              await testUtils.flushPromises();

              assert.calledWith(
                webex.meetings.meetingInfo.fetchMeetingInfo,
                FAKE_LOCUS_MEETING,
                'test type',
                null,
                null,
                undefined,
                undefined,
                infoExtraParamsProvided ? infoExtraParams : {}
              );

              // Parse meeting info is called again with new meeting info
              await testUtils.flushPromises();
              assert.equal(meeting.conversationUrl, 'locusConvURL');
              assert.equal(meeting.locusUrl, 'locusUrl');
              assert.equal(meeting.sipUri, 'locusSipUri');
              assert.equal(meeting.meetingNumber, 'locusMeetingId');
              assert.equal(meeting.meetingJoinUrl, 'meetingJoinUrl');
              assert.equal(meeting.owner, 'locusOwner');
              assert.equal(
                meeting.permissionToken,
                'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0'
              );
              assert.calledWith(
                TriggerProxy.trigger,
                meeting,
                {file: 'meetings', function: 'fetchMeetingInfo'},
                'meeting:meetingInfoAvailable'
              );
            });
          });

          it('creates the meeting from a successful meeting info fetch that has no random delay because it is active', async () => {
            const FAKE_LOCUS_MEETING = {
              conversationUrl: 'locusConvURL',
              url: 'locusUrl',
              info: {
                webExMeetingId: 'locusMeetingId',
                sipUri: 'locusSipUri',
                owner: 'locusOwner',
              },
              meeting: {
                startTime: fakeMeetingStartTimeString,
              },
              fullState: {
                active: true,
              },
            };

            const meeting = await webex.meetings.createMeeting(
              FAKE_LOCUS_MEETING,
              'test type',
              true
            );

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );
            checkCreateWithoutDelay(meeting, FAKE_LOCUS_MEETING, 'test type');
          });

          it('creates the meeting from a successful meeting info fetch that has no random delay because meeting start time is in the past', async () => {
            const FAKE_LOCUS_MEETING = {
              conversationUrl: 'locusConvURL',
              url: 'locusUrl',
              info: {
                webExMeetingId: 'locusMeetingId',
                sipUri: 'locusSipUri',
                owner: 'locusOwner',
              },
              meeting: {
                startTime: fakeMeetingStartTimeString - 1 * 60 * 60 * 1000,
              },
              fullState: {
                active: false,
              },
            };

            const meeting = await webex.meetings.createMeeting(
              FAKE_LOCUS_MEETING,
              'test type',
              true
            );

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );
            checkCreateWithoutDelay(meeting, FAKE_LOCUS_MEETING, 'test type');
          });

          it('creates the meeting from a successful meeting info fetch that has no random delay because enableUnifiedMeetings is disabled', async () => {
            Object.assign(webex.meetings.config, {
              experimental: {
                enableUnifiedMeetings: false,
              },
            });
            const FAKE_LOCUS_MEETING = {
              conversationUrl: 'locusConvURL',
              url: 'locusUrl',
              info: {
                webExMeetingId: 'locusMeetingId',
                sipUri: 'locusSipUri',
                owner: 'locusOwner',
              },
              meeting: {
                startTime: fakeMeetingStartTimeString,
              },
              fullState: {
                active: false,
              },
            };

            const meeting = await webex.meetings.createMeeting(
              FAKE_LOCUS_MEETING,
              'test type',
              true
            );

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );
            checkCreateWithoutDelay(meeting, FAKE_LOCUS_MEETING, 'test type');
          });

          it('creates meeting with the correlationId provided', async () => {
            const meeting = await webex.meetings.createMeeting(
              'test destination',
              'test type',
              false,
              {},
              {correlationId: 'my-correlationId'}
            );

            const expectedMeetingData = {
              correlationId: 'my-correlationId',
            };

            checkCreateWithoutDelay(
              meeting,
              'test destination',
              'test type',
              {},
              expectedMeetingData,
              true
            );
          });

          it('creates meeting with the callStateForMetrics provided', async () => {
            const meeting = await webex.meetings.createMeeting(
              'test destination',
              'test type',
              false,
              {},
              {
                correlationId: 'my-correlationId',
                joinTrigger: 'my-join-trigger',
                loginType: 'my-login-type',
              }
            );

            const expectedMeetingData = {
              correlationId: 'my-correlationId',
              callStateForMetrics: {
                sessionCorrelationId: '',
                correlationId: 'my-correlationId',
                joinTrigger: 'my-join-trigger',
                loginType: 'my-login-type',
              },
            };

            checkCreateWithoutDelay(
              meeting,
              'test destination',
              'test type',
              {},
              expectedMeetingData,
              true
            );
          });
        });

        describe('rejected MeetingInfo.#fetchMeetingInfo', () => {
          beforeEach(() => {
            console.error = sinon.stub().returns(false);
            TriggerProxy.trigger.reset();
            webex.meetings.meetingInfo.fetchMeetingInfo = sinon
              .stub()
              .returns(Promise.reject(new Error('test')));
            webex.meetings.destroy = sinon.stub().returns(Promise.resolve());
            webex.meetings.createMeeting = sinon.spy(webex.meetings.createMeeting);
          });

          const checkCreateMeetingWithNoMeetingInfo = async (failOnMissingMeetingInfo, destroy) => {
            try {
              const meeting = await webex.meetings.createMeeting(
                'test destination',
                'test type',
                undefined,
                undefined,
                undefined,
                failOnMissingMeetingInfo
              );

              assert.instanceOf(
                meeting,
                Meeting,
                'createMeeting should eventually resolve to a Meeting Object'
              );
              assert.calledOnce(webex.meetings.meetingInfo.fetchMeetingInfo);
              assert.calledOnce(MeetingsUtil.getMeetingAddedType);
              assert.calledThrice(TriggerProxy.trigger);
              assert.calledWith(
                webex.meetings.meetingInfo.fetchMeetingInfo,
                'test destination',
                'test type'
              );

              if (destroy) {
                assert.calledWith(
                  webex.meetings.destroy,
                  sinon.match.instanceOf(Meeting),
                  'MISSING_MEETING_INFO'
                );
                assert.notCalled(MeetingsUtil.getMeetingAddedType);
                assert.notCalled(TriggerProxy.trigger);
                assert.throw(webex.meetings.createMeeting, 'meeting information not found');
              } else {
                assert.notCalled(webex.meetings.destroy);
                assert.calledWith(MeetingsUtil.getMeetingAddedType, 'test type');
                assert.calledWith(
                  TriggerProxy.trigger,
                  sinon.match.instanceOf(Meetings),
                  {
                    file: 'meetings',
                    function: 'createMeeting',
                  },
                  'meeting:added',
                  {
                    meeting: sinon.match.instanceOf(Meeting),
                    type: 'test meeting added type',
                  }
                );
              }
            } catch (err) {
              assert.instanceOf(err, NoMeetingInfoError);
            }
          };

          it('creates the meeting from a rejected meeting info fetch', async () => {
            checkCreateMeetingWithNoMeetingInfo(false, false);
          });

          it('creates the meeting from a rejected meeting info fetch and destroys it if failOnMissingMeetingInfo', async () => {
            checkCreateMeetingWithNoMeetingInfo(true, true);
          });

          it('creates the meeting avoiding meeting info fetch by passing type as DESTINATION_TYPE.ONE_ON_ONE_CALL', async () => {
            const meeting = await webex.meetings.createMeeting('test destination', DESTINATION_TYPE.ONE_ON_ONE_CALL);

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );

            assert.notCalled(webex.meetings.meetingInfo.fetchMeetingInfo);
          });

        });

        describe('rejected MeetingInfo.#fetchMeetingInfo - does not log for known Error types', () => {
          forEach(
            [
              {
                error: new CaptchaError(),
                debugLogMessage:
                  'Meetings:index#createMeeting --> Debug CaptchaError: Captcha is required. fetching /meetingInfo for creation.',
              },
              {
                error: new PasswordError(),
                debugLogMessage:
                  'Meetings:index#createMeeting --> Debug PasswordError: Password is required, please use verifyPassword() fetching /meetingInfo for creation.',
              },
              {
                error: new PermissionError(),
                debugLogMessage:
                  'Meetings:index#createMeeting --> Debug PermissionError: Not allowed to execute the function, some properties on server, or local client state do not allow you to complete this action. fetching /meetingInfo for creation.',
              },
              {
                error: new Error(),
                infoLogMessage: true,
                debugLogMessage:
                  'Meetings:index#createMeeting --> Debug Error fetching /meetingInfo for creation.',
              },
            ],
            ({error, debugLogMessage, infoLogMessage}) => {
              it('creates the meeting from a rejected meeting info fetch', async () => {
                webex.meetings.meetingInfo.fetchMeetingInfo = sinon
                  .stub()
                  .returns(Promise.reject(error));

                LoggerProxy.logger.debug = sinon.stub();
                LoggerProxy.logger.info = sinon.stub();

                const meeting = await webex.meetings.createMeeting('test destination', 'test type');

                assert.instanceOf(
                  meeting,
                  Meeting,
                  'createMeeting should eventually resolve to a Meeting Object'
                );

                assert.calledWith(LoggerProxy.logger.debug, debugLogMessage);

                if (infoLogMessage) {
                  assert.calledWith(
                    LoggerProxy.logger.info,
                    'Meetings:index#createMeeting --> Info Unable to fetch meeting info for test destination.'
                  );
                } else {
                  assert.notCalled(LoggerProxy.logger.info);
                }
              });
            }
          );
        });
      });
    });
    describe('Public Event Triggers', () => {
      let cleanUpSpy;
      describe('#destroy', () => {
        beforeEach(() => {
          cleanUpSpy = sinon.stub(MeetingUtil, 'cleanUp');
        });
        afterEach(() => {
          cleanUpSpy.restore();
        });
        it('should have #destroy', () => {
          assert.exists(webex.meetings.destroy);
        });
        describe('correctly established meeting', () => {
          beforeEach(() => {
            webex.meetings.meetingCollection.delete = sinon.stub().returns(true);
          });

          it('tests the destroy removal from the collection', async () => {
            const meeting = await webex.meetings.createMeeting('test', 'test');

            webex.meetings.destroy(meeting, test1);

            assert.calledOnce(webex.meetings.meetingCollection.delete);
            assert.calledWith(webex.meetings.meetingCollection.delete, meeting.id);
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meetings),
              {
                file: 'meetings',
                function: 'destroy',
              },
              'meeting:removed',
              {
                meetingId: meeting.id,
                reason: test1,
              }
            );
          });
        });

        describe('with auto upload logs enabled', () => {
          beforeEach(() => {
            webex.config.autoUploadLogs = true;
            webex.meetings.loggerRequest.uploadLogs = sinon.stub().returns(Promise.resolve());
          });

          // Invalid test currently does not upload log on destroy of meeting when we do destory
          // rather happens when we do leave or when via the meetign object action
          xit('uploads logs on destroy', async () => {
            const meeting = await webex.meetings.createMeeting('test', 'test');

            webex.meetings.destroy(meeting, test1);
            assert.calledOnce(webex.meetings.loggerRequest.uploadLogs);
          });
        });
      });

      describe('#network:disconnected', () => {
        it('should trigger event upon mercury disconnect', () => {
          const {meetings} = webex;
          const SCOPE = {
            file: 'meetings/index',
            function: 'handleMercuryOffline',
          };
          const EVENT = 'network:disconnected';

          TriggerProxy.trigger.reset();

          meetings.handleMercuryOffline = sinon.spy(meetings.handleMercuryOffline);
          webex.internal.mercury.disconnect = sinon.stub().callsFake(meetings.handleMercuryOffline);

          webex.internal.mercury.disconnect();

          assert.calledOnce(meetings.handleMercuryOffline);
          assert.calledOnce(TriggerProxy.trigger);
          assert.calledWith(TriggerProxy.trigger, webex.internal.mercury, SCOPE, EVENT);
        });
      });

      describe('#fetchUserPreferredWebexSite', () => {
        let loggerProxySpy;

        it('should call request.getMeetingPreferences to get the preferred webex site ', async () => {
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), []);
          assert.isDefined(webex.meetings.preferredWebexSite);
          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, 'go.webex.com');
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), [
            'go.webex.com',
          ]);
        });

        const setup = ({user} = {}) => {
          loggerProxySpy = sinon.spy(LoggerProxy.logger, 'error');
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), []);

          Object.assign(webex.internal, {
            user: {
              get: sinon.stub().returns(Promise.resolve(user)),
            },
          });

          Object.assign(webex.internal.services, {
            getMeetingPreferences: sinon.stub().returns(Promise.resolve({})),
          });
        };

        it('should not fail if UserPreferred info is not fetched ', async () => {
          setup();

          await webex.meetings.fetchUserPreferredWebexSite().then(() => {
            assert.equal(webex.meetings.preferredWebexSite, '');
          });
          assert.calledOnceWithExactly(
            loggerProxySpy,
            'Failed to fetch preferred site from user - no site will be set'
          );
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), ['']);
        });

        it('should fall back to fetching the site from the user', async () => {
          setup({
            user: {
              userPreferences: {
                userPreferencesItems: {
                  preferredWebExSite: 'site.webex.com',
                },
              },
            },
          });

          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, 'site.webex.com');
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), [
            '',
            'site.webex.com',
          ]);
          assert.notCalled(loggerProxySpy);
        });

        forEach(
          [
            {user: undefined},
            {user: {userPreferences: {}}},
            {user: {userPreferences: {userPreferencesItems: {}}}},
            {user: {userPreferences: {userPreferencesItems: {preferredWebExSite: undefined}}}},
          ],
          ({user}) => {
            it(`should handle invalid user data ${user}`, async () => {
              setup({user});

              await webex.meetings.fetchUserPreferredWebexSite();

              assert.equal(webex.meetings.preferredWebexSite, '');
              assert.calledOnceWithExactly(
                loggerProxySpy,
                'Failed to fetch preferred site from user - no site will be set'
              );
              assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), ['']);
            });
          }
        );

        it('should handle a get user failure', async () => {
          setup();

          webex.internal.user.get.rejects(new Error());

          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, '');
          assert.calledOnceWithExactly(
            loggerProxySpy,
            'Failed to fetch preferred site from user - no site will be set'
          );
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), ['']);
        });

        it('should fall back to fetching the site from the user', async () => {
          setup({
            user: {
              userPreferences: {
                userPreferencesItems: {
                  preferredWebExSite: 'site.webex.com',
                },
              },
            },
          });

          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, 'site.webex.com');
          assert.notCalled(loggerProxySpy);
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), [
            '',
            'site.webex.com',
          ]);
        });

        forEach(
          [
            {user: undefined},
            {user: {userPreferences: {}}},
            {user: {userPreferences: {userPreferencesItems: {}}}},
            {user: {userPreferences: {userPreferencesItems: {preferredWebExSite: undefined}}}},
          ],
          ({user}) => {
            it(`should handle invalid user data ${user}`, async () => {
              setup({user});

              await webex.meetings.fetchUserPreferredWebexSite();

              assert.equal(webex.meetings.preferredWebexSite, '');
              assert.calledOnceWithExactly(
                loggerProxySpy,
                'Failed to fetch preferred site from user - no site will be set'
              );
              assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), ['']);
            });
          }
        );

        it('should handle a get user failure', async () => {
          setup();

          webex.internal.user.get.rejects(new Error());

          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, '');
          assert.calledOnceWithExactly(
            loggerProxySpy,
            'Failed to fetch preferred site from user - no site will be set'
          );
          assert.deepEqual(webex.internal.services._getCatalog().getAllowedDomains(), ['']);
        });
      });
    });

    describe('#setupLocusControlListeners', () => {
      let meeting;

      beforeEach(async () => {
        webex.internal.device.userId = uuid1;
        webex.internal.device.url = url1;
        MeetingCollection.set = sinon.stub().returns(true);
        MeetingsUtil.getMeetingAddedType = sinon.stub().returns('test meeting added type');
        TriggerProxy.trigger.reset();
        // clock = sinon.useFakeTimers();
        // setTimeoutSpy = sinon.spy(clock, 'setTimeout');
        webex.meetings.meetingInfo.fetchMeetingInfo = sinon.stub().returns(
          Promise.resolve({
            body: {
              permissionToken:
                'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
              meetingJoinUrl: 'meetingJoinUrl',
            },
          })
        );

        meeting = await webex.meetings.createMeeting('test destination', 'test type');

        TriggerProxy.trigger.reset();
      });

      it('triggers correct event when CONTROLS_ENTRY_EXIT_TONE_UPDATED emitted', async () => {
        await meeting.locusInfo.emitScoped({}, LOCUSINFO.EVENTS.CONTROLS_ENTRY_EXIT_TONE_UPDATED, {
          entryExitTone: 'foo',
        });

        assert.calledOnce(TriggerProxy.trigger);
        assert.calledWith(
          TriggerProxy.trigger,
          sinon.match.instanceOf(Meeting),
          {
            file: 'meeting/index',
            function: 'setupLocusControlsListener',
          },
          EVENT_TRIGGERS.MEETING_ENTRY_EXIT_TONE_UPDATE,
          {entryExitTone: 'foo'}
        );
      });

      const checkSelfTrigger = async (inEvent, outEvent) => {
        await meeting.locusInfo.emitScoped({}, inEvent, {foo: 'bar'});

        assert.calledOnce(TriggerProxy.trigger);
        assert.calledWith(
          TriggerProxy.trigger,
          sinon.match.instanceOf(Meeting),
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoSelfListener',
          },
          outEvent,
          {payload: {foo: 'bar'}}
        );
      };

      it('triggers correct event when SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE emitted', async () => {
        checkSelfTrigger(
          LOCUSINFO.EVENTS.SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE,
          EVENT_TRIGGERS.MEETING_SELF_CANNOT_VIEW_PARTICIPANT_LIST
        );
      });

      it('triggers correct event when SELF_IS_SHARING_BLOCKED_CHANGE emitted', async () => {
        checkSelfTrigger(
          LOCUSINFO.EVENTS.SELF_IS_SHARING_BLOCKED_CHANGE,
          EVENT_TRIGGERS.MEETING_SELF_IS_SHARING_BLOCKED
        );
      });

      it('triggers correct event when LOCAL_UNMUTE_REQUESTED emitted', async () => {
        checkSelfTrigger(
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED,
          EVENT_TRIGGERS.MEETING_SELF_REQUESTED_TO_UNMUTE
        );
      });
    });

    describe('#isNeedHandleMainLocus', () => {
      let meeting;
      let newLocus;
      beforeEach(() => {
        meeting = {
          controls: {},
          self: {},
        };
        newLocus = {
          controls: {},
          self: {},
        };
      });
      afterEach(() => {
        sinon.restore();
      });
      it('check normal case will return true', () => {
        sinon.stub(webex.meetings.meetingCollection, 'getActiveBreakoutLocus').returns(null);
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, true);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> this is a normal main session locusDTO update case'
        );
      });

      it('check self joined and joined on this device, return true', () => {
        sinon.stub(webex.meetings.meetingCollection, 'getActiveBreakoutLocus').returns(null);
        newLocus.self.state = 'JOINED';
        sinon.stub(MeetingsUtil, 'joinedOnThisDevice').returns(true);

        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, true);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> self this device shown as JOINED in the main session'
        );
      });

      it('if newLocus replaceAt time is expired, then return false', () => {
        sinon.stub(webex.meetings.meetingCollection, 'getActiveBreakoutLocus').returns({
          joinedWith: {
            replaces: [
              {
                replaceAt: '2023-03-27T02:17:02.506Z',
              },
            ],
          },
        });
        newLocus.self.state = 'JOINED';
        sinon.stub(MeetingsUtil, 'joinedOnThisDevice').returns(true);
        sinon.stub(MeetingsUtil, 'getThisDevice').returns({
          replaces: [
            {
              replaceAt: '2023-03-27T02:17:01.506Z',
            },
          ],
        });

        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, false);
        assert.calledWith(
          LoggerProxy.logger.log,
          `Meetings:index#isNeedHandleMainLocus --> this is expired main joined status locus_dto replacedAt 2023-03-27T02:17:01.506Z bo replacedAt 2023-03-27T02:17:02.506Z`
        );
      });

      it('check current is in breakout join with this device, return false', () => {
        sinon.stub(webex.meetings.meetingCollection, 'getActiveBreakoutLocus').returns({
          joinedWith: {
            correlationId: '111',
          },
        });
        newLocus.controls.breakout = {url: 'url'};
        meeting.correlationId = '111';

        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, false);
        assert.calledWith(
          LoggerProxy.logger.log,
          `Meetings:index#isNeedHandleMainLocus --> there is active breakout session and joined on this device, and don't need to handle main session: url`
        );
      });

      it('check self is moved and removed, return false', () => {
        webex.meetings.meetingCollection.getActiveBreakoutLocus = sinon.stub().returns(null);
        newLocus.self.state = 'LEFT';
        newLocus.self.reason = 'MOVED';
        newLocus.self.removed = true;
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, false);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> self moved main locus with self removed status or with device resource moved, not need to handle'
        );
      });

      it('check self is moved and device resource removed, return false', () => {
        webex.meetings.meetingCollection.getActiveBreakoutLocus = sinon.stub().returns(null);
        newLocus.self.state = 'LEFT';
        newLocus.self.reason = 'MOVED';
        sinon.stub(MeetingsUtil, 'getThisDevice').returns({
          state: 'LEFT',
          reason: 'MOVED',
        });
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, false);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> self moved main locus with self removed status or with device resource moved, not need to handle'
        );
      });

      it('check self is joined but device resource removed, return false', () => {
        webex.meetings.meetingCollection.getActiveBreakoutLocus = sinon.stub().returns(null);
        sinon.stub(MeetingsUtil, 'joinedOnThisDevice').returns(false);
        newLocus.self.state = 'JOINED';
        sinon.stub(MeetingsUtil, 'getThisDevice').returns({
          state: 'LEFT',
          reason: 'MOVED',
        });
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleMainLocus(meeting, newLocus);
        assert.equal(result, false);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> self device left&moved in main locus with self joined status, not need to handle'
        );
      });
    });

    describe('#isNeedHandleLocusDTO', () => {
      let meeting;
      let newLocus;
      beforeEach(() => {
        meeting = {
          controls: {},
          self: {},
        };
        newLocus = {
          controls: {},
          self: {},
        };
      });
      afterEach(() => {
        sinon.restore();
      });
      it('initial DTO , joined breakout session, return true', () => {
        newLocus.controls.breakout = {
          sessionType: 'BREAKOUT',
        };
        newLocus.self.state = 'JOINED';
        newLocus.self.devices = [];
        newLocus.fullState = {
          active: true,
        };
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleLocusDTO(null, newLocus);
        assert.equal(result, true);
        assert.calledWith(
          LoggerProxy.logger.log,
          `Meetings:index#isNeedHandleLocusDTO --> the first breakout session locusDTO active status: true`
        );
      });
      it('others go to check isNeedHandleMainLocus', () => {
        newLocus.controls.breakout = {
          sessionType: 'MAIN',
        };
        newLocus.self.state = 'JOINED';
        newLocus.self.devices = [];
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleLocusDTO(meeting, newLocus);
        assert.equal(result, true);
        assert.calledWith(
          LoggerProxy.logger.log,
          'Meetings:index#isNeedHandleMainLocus --> this is a normal main session locusDTO update case'
        );
      });
      it('joined breakout session, self status is moved, return false', () => {
        newLocus.controls.breakout = {
          sessionType: 'BREAKOUT',
        };
        newLocus.self.state = 'LEFT';
        newLocus.self.reason = 'MOVED';
        newLocus.self.devices = [];
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleLocusDTO(meeting, newLocus);
        assert.equal(result, false);
      });
      it('moved to lobby, return true', () => {
        newLocus.controls.breakout = {
          sessionType: 'MAIN',
        };
        newLocus.self.state = 'JOINED';
        newLocus.self.devices = [
          {
            intent: {
              reason: 'ON_HOLD_LOBBY',
              type: 'WAIT',
            },
          },
        ];
        LoggerProxy.logger.log = sinon.stub();
        const result = webex.meetings.isNeedHandleLocusDTO(meeting, newLocus);
        assert.equal(result, true);
      });
    });

    describe('#getCorrespondingMeetingByLocus', () => {
      let locus;
      let mockReturnMeeting = {meeting: 'meeting1'};
      const mockGetByKey = (keyWillReturnMeeting) => {
        webex.meetings.meetingCollection.getByKey = sinon.stub().callsFake((key) => {
          if (key === keyWillReturnMeeting) {
            return mockReturnMeeting;
          }
          return null;
        });
      };

      beforeEach(() => {
        locus = {
          controls: {},
          self: {
            callbackInfo: {
              callbackAddress: 'address1',
            },
          },
          info: {
            webExMeetingId: '123456',
            isUnifiedSpaceMeeting: false,
          },
          conversationUrl: 'conversationUrl1',
        };

        sinon.stub(MeetingsUtil, 'checkForCorrelationId').returns('correlationId1');
      });
      afterEach(() => {
        sinon.restore();
      });
      it('check the calls when no meeting found in meetingCollection', () => {
        mockGetByKey();
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.isNull(result);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'correlationId',
          'correlationId1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'sipUri', 'address1');
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'conversationUrl',
          'conversationUrl1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'meetingNumber', '123456');
      });

      it('not try getByKey "conversationUrl" when isUnifiedSpaceMeeting is true', () => {
        mockGetByKey();
        locus.info.isUnifiedSpaceMeeting = true;
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.isNull(result);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
      });

      it('check the calls when meeting found by key: locusUrl', () => {
        mockGetByKey('locusUrl');
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.deepEqual(result, mockReturnMeeting);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 1);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
      });

      it('check the calls when meeting found by key: correlationId', () => {
        mockGetByKey('correlationId');
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.deepEqual(result, mockReturnMeeting);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 2);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'correlationId',
          'correlationId1'
        );
      });

      it('check the calls when meeting found by key: sipUri', () => {
        mockGetByKey('sipUri');
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.deepEqual(result, mockReturnMeeting);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 3);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'correlationId',
          'correlationId1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'sipUri', 'address1');
      });

      it('check the calls when meeting found by key: conversationUrl', () => {
        mockGetByKey('conversationUrl');
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.deepEqual(result, mockReturnMeeting);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'correlationId',
          'correlationId1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'sipUri', 'address1');
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'conversationUrl',
          'conversationUrl1'
        );
      });

      it('check the calls when meeting found by key: meetingNumber', () => {
        mockGetByKey('meetingNumber');
        const result = webex.meetings.getCorrespondingMeetingByLocus({locus, locusUrl: url1});
        assert.deepEqual(result, mockReturnMeeting);
        assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'correlationId',
          'correlationId1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'sipUri', 'address1');
        assert.calledWith(
          webex.meetings.meetingCollection.getByKey,
          'conversationUrl',
          'conversationUrl1'
        );
        assert.calledWith(webex.meetings.meetingCollection.getByKey, 'meetingNumber', '123456');
      });
    });

    describe('#sortLocusArrayToUpdate', () => {
      let lociArray;
      let mainLocus;
      let breakoutLocus;
      beforeEach(() => {
        mainLocus = {
          url: 'mainUrl1',
          controls: {
            breakout: {
              sessionType: 'MAIN',
              url: 'breakoutUnifiedUrl1',
            },
          },
        };
        breakoutLocus = {
          url: 'breakoutUrl1',
          controls: {
            breakout: {
              sessionType: 'BREAKOUT',
              url: 'breakoutUnifiedUrl1',
            },
          },
        };
        lociArray = [mainLocus, breakoutLocus];

        sinon.stub(MeetingsUtil, 'isValidBreakoutLocus').callsFake((locus) => {
          return locus.url === 'breakoutUrl1';
        });
      });
      afterEach(() => {
        sinon.restore();
      });

      it('if both main and breakout locus is in array for non-exist meeting, return main locus to create first', () => {
        webex.meetings.meetingCollection.getByKey = sinon.stub().returns(undefined);
        const result = webex.meetings.sortLocusArrayToUpdate(lociArray);
        assert.deepEqual(result, [mainLocus]);
        assert.deepEqual(webex.meetings.breakoutLocusForHandleLater, [breakoutLocus]);
      });

      it('if both main and breakout locus is in array for an exist meeting, return all locus', () => {
        webex.meetings.meetingCollection.getByKey = sinon.stub().returns({});
        const result = webex.meetings.sortLocusArrayToUpdate(lociArray);
        assert.deepEqual(result, [mainLocus, breakoutLocus]);
        assert.deepEqual(webex.meetings.breakoutLocusForHandleLater, []);
      });

      it('if the breakout locus has no associated main locus, return all', () => {
        webex.meetings.meetingCollection.getByKey = sinon.stub().returns({});
        breakoutLocus.controls.breakout.url = 'testUrl';
        const result = webex.meetings.sortLocusArrayToUpdate(lociArray);
        assert.deepEqual(result, [mainLocus, breakoutLocus]);
      });
    });

    describe('#checkHandleBreakoutLocus', () => {
      let breakoutLocus;
      beforeEach(() => {
        breakoutLocus = {
          url: 'breakoutUrl1',
          controls: {
            breakout: {
              sessionType: 'BREAKOUT',
              url: 'breakoutUnifiedUrl1',
            },
          },
        };

        webex.meetings.handleLocusEvent = sinon.stub();
      });
      afterEach(() => {
        sinon.restore();
      });
      it('do nothing if new created locus is null/no cached breakouts for updating', () => {
        webex.meetings.checkHandleBreakoutLocus(null);
        webex.meetings.breakoutLocusForHandleLater = null;
        webex.meetings.checkHandleBreakoutLocus({});
        webex.meetings.breakoutLocusForHandleLater = [];
        webex.meetings.checkHandleBreakoutLocus({});
        assert.notCalled(webex.meetings.handleLocusEvent);
      });

      it('do nothing if new created locus is breakout locus', () => {
        webex.meetings.breakoutLocusForHandleLater = [breakoutLocus];
        webex.meetings.checkHandleBreakoutLocus(breakoutLocus);
        assert.notCalled(webex.meetings.handleLocusEvent);
      });

      it('do nothing if no cached locus is associated with the new created locus', () => {
        webex.meetings.breakoutLocusForHandleLater = [breakoutLocus];
        webex.meetings.checkHandleBreakoutLocus({
          controls: {
            breakout: {
              sessionType: 'MAIN',
              url: 'breakoutUnifiedUrl2',
            },
          },
        });
        assert.notCalled(webex.meetings.handleLocusEvent);
      });

      it('update the cached breakout locus which associate the new created locus', () => {
        webex.meetings.breakoutLocusForHandleLater = [breakoutLocus];
        webex.meetings.checkHandleBreakoutLocus({
          controls: {
            breakout: {
              sessionType: 'MAIN',
              url: 'breakoutUnifiedUrl1',
            },
          },
        });
        assert.calledWith(webex.meetings.handleLocusEvent, {
          locus: breakoutLocus,
          locusUrl: breakoutLocus.url,
        });
      });
    });

    describe('uploading of logs', () => {
      let metricsSpy;
      let meeting;

      beforeEach(async () => {
        webex.meetings.config.autoUploadLogs = true;
        webex.meetings.loggerRequest.uploadLogs = sinon.stub().resolves();

        sinon.stub(webex.meetings.meetingInfo, 'fetchInfoOptions').resolves({});
        sinon.stub(webex.meetings.meetingInfo, 'fetchMeetingInfo').resolves({});

        triggerProxyStub.restore();

        metricsSpy = sinon.stub(Metrics, 'sendBehavioralMetric');

        meeting = await webex.meetings.create('test');

        meeting.locusId = 'locus id';
        meeting.correlationId = 'correlation id';
        meeting.locusInfo = {
          fullState: {lastActive: 'last active', sessionId: 'locus session id'},
          info: {webExMeetingId: 'meeting id'},
        };
      });

      afterEach(() => {
        sinon.restore();
      });

      it('sends metrics on success', async () => {
        await meeting.uploadLogs();

        await testUtils.flushPromises();

        assert.calledOnceWithExactly(metricsSpy, 'js_sdk_upload_logs_success', {
          callStart: 'last active',
          correlationId: 'correlation id',
          feedbackId: 'correlation id',
          locusId: 'locus id',
          meetingId: 'meeting id',
          autoupload: true,
          locussessionid: 'locus session id',
        });
      });

      it('sends metrics on failure', async () => {
        webex.meetings.loggerRequest.uploadLogs.rejects(new Error('fake error'));

        await meeting.uploadLogs();

        await testUtils.flushPromises();

        assert.calledOnceWithExactly(
          metricsSpy,
          'js_sdk_upload_logs_failure',
          sinon.match({
            callStart: 'last active',
            correlationId: 'correlation id',
            feedbackId: 'correlation id',
            locusId: 'locus id',
            meetingId: 'meeting id',
            reason: 'fake error',
            autoupload: true,
            locussessionid: 'locus session id',
          })
        );
      });
    });
  });
});
