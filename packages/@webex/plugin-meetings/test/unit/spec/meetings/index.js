/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';

import Device from '@webex/internal-plugin-device';
import Mercury from '@webex/internal-plugin-mercury';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import TriggerProxy from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import Meeting from '@webex/plugin-meetings/src/meeting';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import Meetings from '@webex/plugin-meetings/src/meetings';
import MeetingCollection from '@webex/plugin-meetings/src/meetings/collection';
import MeetingsUtil from '@webex/plugin-meetings/src/meetings/util';
import PersonalMeetingRoom from '@webex/plugin-meetings/src/personal-meeting-room';
import Reachability from '@webex/plugin-meetings/src/reachability';

import testUtils from '../../../utils/testUtils';
import {
  LOCUSEVENT,
  OFFLINE,
  ONLINE,
  ROAP,
  LOCUSINFO,
  EVENT_TRIGGERS,
} from '../../../../src/constants';

describe('plugin-meetings', () => {
  const logger = {
    log: () => {},
    info: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {},
  };

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
    TriggerProxy.trigger = sinon.stub().returns(true);
  });

  let webex;
  let uuid1;
  let uri1;
  let url1;
  let test1;
  let test2;

  describe('meetings index', () => {
    beforeEach(() => {
      MeetingsUtil.checkH264Support = sinon.stub();
      uuid1 = uuid.v4();
      url1 = `https://example.com/${uuid.v4()}`;
      uri1 = `test-${uuid.v4()}@example.com`;
      test1 = `test-${uuid.v4()}`;
      test2 = `test2-${uuid.v4()}`;
      webex = new MockWebex({
        children: {
          device: Device,
          mercury: Mercury,
          meetings: Meetings,
        },
      });

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

      Object.assign(webex.meetings, {
        startReachability: sinon.stub().returns(Promise.resolve()),
      });

      Object.assign(webex.internal, {
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
          fetchClientRegionInfo: sinon.stub().returns(Promise.resolve()),
        },
        metrics: {
          submitClientMetrics: sinon.stub().returns(Promise.resolve()),
        },
      });
      webex.emit('ready');
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

    describe('#_toggleTurnDiscovery', () => {
      it('should have toggleAdhocMeetings', () => {
        assert.equal(typeof webex.meetings._toggleTurnDiscovery, 'function');
      });

      describe('success', () => {
        it('should update meetings to do TURN discovery', () => {
          webex.meetings._toggleTurnDiscovery(true);
          assert.equal(webex.meetings.config.experimental.enableTurnDiscovery, true);

          webex.meetings._toggleTurnDiscovery(false);
          assert.equal(webex.meetings.config.experimental.enableTurnDiscovery, false);
        });
      });

      describe('failure', () => {
        it('should not accept non boolean input', () => {
          const currentEnableTurnDiscovery = webex.meetings.config.experimental.enableTurnDiscovery;

          webex.meetings._toggleTurnDiscovery('test');
          assert.equal(
            webex.meetings.config.experimental.enableAdhocMeetings,
            currentEnableTurnDiscovery
          );
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

      describe('gets', () => {
        describe('#getReachability', () => {
          it('should have #getReachability', () => {
            assert.exists(webex.meetings.getReachability);
          });
          describe('before #setReachability', () => {
            it('does not get a reachability instance', () => {
              const reachability = webex.meetings.getReachability();

              assert.notExists(
                reachability,
                'reachability is undefined because #setReachability has not been called'
              );
            });
          });
          describe('after #setReachability', () => {
            beforeEach(() => {
              webex.meetings.setReachability();
              const reachabilityMocker = webex.meetings.getReachability();

              sinon.stub(reachabilityMocker, 'gatherReachability').returns(true);
            });
            it('gets the reachability data instance from webex.meetings', () => {
              const reachability = webex.meetings.getReachability();

              assert.exists(
                reachability,
                'reachability is defined because #setReachability has been called'
              );
              assert.instanceOf(reachability, Reachability, 'should be a reachability instance');
            });
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
                webex.meetings.getAllMeetings({
                  test: test1,
                });
                assert.calledOnce(webex.meetings.meetingCollection.getAll);
                assert.calledWith(webex.meetings.meetingCollection.getAll, {
                  test: test1,
                });
              });
            });
          });
        });
      });
      describe('#syncMeetings', () => {
        it('should have #syncMeetings', () => {
          assert.exists(webex.meetings.syncMeetings);
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
            let parse;

            beforeEach(() => {
              parse = sinon.stub().returns(true);
              webex.meetings.meetingCollection.getByKey = sinon.stub().returns({
                locusInfo: {
                  parse,
                },
              });
            });
            it('tests the sync meeting calls for existing meeting', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(webex.meetings.meetingCollection.getByKey);
              assert.calledOnce(parse);
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
                    initialSetup,
                  },
                })
              );
            });
            it('tests the sync meeting calls for not existing meeting', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
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
          describe('destory non active meeting', () => {
            let initialSetup;
            let parse;
            let destroySpy;

            beforeEach(() => {
              destroySpy = sinon.spy(webex.meetings, 'destroy');
              parse = sinon.stub().returns(true);
              initialSetup = sinon.stub().returns(true);
              webex.meetings.meetingCollection.getByKey = sinon.stub().returns({
                locusInfo: {
                  parse,
                },
                sendCallAnalyzerMetrics: sinon.stub(),
              });
              webex.meetings.meetingCollection.getAll = sinon.stub().returns({
                meetingutk: {
                  locusUrl: 'fdfdjfdhj',
                  sendCallAnalyzerMetrics: sinon.stub(),
                },
              });
              webex.meetings.create = sinon.stub().returns(
                Promise.resolve({
                  locusInfo: {
                    initialSetup,
                  },
                  sendCallAnalyzerMetrics: sinon.stub(),
                })
              );
              webex.meetings.request.getActiveMeetings = sinon.stub().returns(
                Promise.resolve({
                  loci: [],
                })
              );
              MeetingUtil.cleanUp = sinon.stub().returns(Promise.resolve());
            });
            it('destroy non active meetings', async () => {
              await webex.meetings.syncMeetings();
              assert.calledOnce(webex.meetings.request.getActiveMeetings);
              assert.calledOnce(destroySpy);

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

        it('calls createMeeting and returns its promise', async () => {
          const FAKE_USE_RANDOM_DELAY = true;
          const create = webex.meetings.create(test1, test2, FAKE_USE_RANDOM_DELAY);

          assert.exists(create.then);
          await create;
          assert.calledOnce(webex.meetings.createMeeting);
          assert.calledWith(webex.meetings.createMeeting, test1, test2, FAKE_USE_RANDOM_DELAY);
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
          let parse;

          beforeEach(() => {
            parse = sinon.stub().returns(true);
            webex.meetings.meetingCollection.getByKey = sinon.stub().returns({
              locusInfo: {
                parse,
              },
            });
          });
          it('should parse the meeting info', () => {
            webex.meetings.handleLocusEvent({
              locusUrl: url1,
            });
            assert.calledOnce(webex.meetings.meetingCollection.getByKey);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledOnce(parse);
            assert.calledWith(
              parse,
              {
                locusInfo: {
                  parse,
                },
              },
              {
                locusUrl: url1,
              }
            );
          });
        });
        describe('there was not a meeting', () => {
          let initialSetup;

          beforeEach(() => {
            initialSetup = sinon.stub().returns(true);
            webex.meetings.meetingCollection.getByKey = sinon.stub().returns(undefined);
            webex.meetings.create = sinon.stub().returns(
              Promise.resolve({
                locusInfo: {
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
                },
              },
              eventType: 'locus.difference',
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 5);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
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
                },
              },
              eventType: 'locus.difference',
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledOnce(initialSetup);
            assert.calledWith(initialSetup, {
              id: uuid1,
              self: {
                callBackInfo: {
                  callbackAddress: uri1,
                },
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
                },
              },
              eventType: test1,
              locusUrl: url1,
            });
            assert.callCount(webex.meetings.meetingCollection.getByKey, 4);
            assert.calledWith(webex.meetings.meetingCollection.getByKey, 'locusUrl', url1);
            assert.calledOnce(initialSetup);
            assert.calledWith(initialSetup, {
              id: uuid1,
              self: {
                callBackInfo: {
                  callbackAddress: uri1,
                },
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
            assert.callCount(webex.meetings.meetingCollection.getByKey, 3);
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
          MediaUtil.createPeerConnection = sinon.stub().returns(true);
          webex.internal.device.userId = uuid1;
          webex.internal.device.url = url1;
          MeetingCollection.set = sinon.stub().returns(true);
          MeetingsUtil.getMeetingAddedType = sinon.stub().returns('test meeting added type');
          TriggerProxy.trigger.reset();
        });
        describe('successful MeetingInfo.#fetchMeetingInfo', () => {
          let clock, setTimeoutSpy, fakeMeetingStartTimeString, FAKE_TIME_TO_START;

          beforeEach(() => {
            clock = sinon.useFakeTimers();
            setTimeoutSpy = sinon.spy(clock, 'setTimeout');
            webex.meetings.meetingInfo.fetchMeetingInfo = sinon.stub().returns(
              Promise.resolve({
                body: {
                  permissionToken: 'PT',
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
            expectedMeetingData = {}
          ) => {
            assert.calledOnce(webex.meetings.meetingInfo.fetchMeetingInfo);
            assert.calledOnce(MeetingsUtil.getMeetingAddedType);
            assert.notCalled(setTimeoutSpy);
            assert.calledThrice(TriggerProxy.trigger);
            assert.calledWith(webex.meetings.meetingInfo.fetchMeetingInfo, destination, type);
            assert.calledWith(MeetingsUtil.getMeetingAddedType, 'test type');

            if (expectedMeetingData.permissionToken) {
              assert.equal(meeting.permissionToken, expectedMeetingData.permissionToken);
            }
            if (expectedMeetingData.meetingJoinUrl) {
              assert.equal(meeting.meetingJoinUrl, expectedMeetingData.meetingJoinUrl);
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
              permissionToken: 'PT',
              meetingJoinUrl: 'meetingJoinUrl',
            };

            checkCreateWithoutDelay(meeting, 'test destination', 'test type', expectedMeetingData);
          });

          it('creates the meeting from a successful meeting info fetch meeting resolve testing', async () => {
            const meeting = await webex.meetings.createMeeting('test destination', 'test type');
            const expectedMeetingData = {
              permissionToken: 'PT',
              meetingJoinUrl: 'meetingJoinUrl',
            };

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );
            checkCreateWithoutDelay(meeting, 'test destination', 'test type', expectedMeetingData);
          });

          it('creates the meeting from a successful meeting info fetch with random delay', async () => {
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
            assert.calledWith(
              webex.meetings.meetingInfo.fetchMeetingInfo,
              FAKE_LOCUS_MEETING,
              'test type'
            );

            // Parse meeting info is called again with new meeting info
            await testUtils.flushPromises();
            assert.equal(meeting.conversationUrl, 'locusConvURL');
            assert.equal(meeting.locusUrl, 'locusUrl');
            assert.equal(meeting.sipUri, 'locusSipUri');
            assert.equal(meeting.meetingNumber, 'locusMeetingId');
            assert.equal(meeting.meetingJoinUrl, 'meetingJoinUrl');
            assert.equal(meeting.owner, 'locusOwner');
            assert.equal(meeting.permissionToken, 'PT');

            assert.calledWith(
              TriggerProxy.trigger,
              meeting,
              {file: 'meetings', function: 'fetchMeetingInfo'},
              'meeting:meetingInfoAvailable'
            );
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
        });

        describe('rejected MeetingInfo.#fetchMeetingInfo', () => {
          beforeEach(() => {
            console.error = sinon.stub().returns(false);
            TriggerProxy.trigger.reset();
            webex.meetings.meetingInfo.fetchMeetingInfo = sinon
              .stub()
              .returns(Promise.reject(new Error('test')));
          });
          it('creates the meeting from a rejected meeting info fetch', async () => {
            const meeting = await webex.meetings.createMeeting('test destination', 'test type');

            assert.instanceOf(
              meeting,
              Meeting,
              'createMeeting should eventually resolve to a Meeting Object'
            );
            assert.calledOnce(webex.meetings.meetingInfo.fetchMeetingInfo);
            assert.calledOnce(MeetingsUtil.getMeetingAddedType);
            assert.calledTwice(TriggerProxy.trigger);
            assert.calledWith(
              webex.meetings.meetingInfo.fetchMeetingInfo,
              'test destination',
              'test type'
            );
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
          });
        });
      });
    });
    describe('Public Event Triggers', () => {
      describe('#destroy', () => {
        beforeEach(() => {
          MediaUtil.createPeerConnection = sinon.stub().returns(true);
          MeetingUtil.cleanUp = sinon.stub();
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
        it('should call request.getMeetingPreferences to get the preferred webex site ', async () => {
          assert.isDefined(webex.meetings.preferredWebexSite);
          await webex.meetings.fetchUserPreferredWebexSite();

          assert.equal(webex.meetings.preferredWebexSite, 'go.webex.com');
        });

        it('should not fail if UserPreferred info is not fetched ', async () => {
          Object.assign(webex.internal, {
            services: {
              getMeetingPreferences: sinon.stub().returns(Promise.resolve({})),
            },
          });

          await webex.meetings.fetchUserPreferredWebexSite().then(() => {
            assert.equal(webex.meetings.preferredWebexSite, '');
          });
        });
      });
    });

    describe('#setupLocusControlListeners', () => {
      let meeting;

      beforeEach(async () => {
        MediaUtil.createPeerConnection = sinon.stub().returns(true);
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
              permissionToken: 'PT',
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
  });
});
