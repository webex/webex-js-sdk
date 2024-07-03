import 'jsdom-global/register';
import sinon from 'sinon';
import {cloneDeep} from 'lodash';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import testUtils from '../../../utils/testUtils';
import Meetings from '@webex/plugin-meetings';
import LocusInfo from '@webex/plugin-meetings/src/locus-info';
import SelfUtils from '@webex/plugin-meetings/src/locus-info/selfUtils';
import InfoUtils from '@webex/plugin-meetings/src/locus-info/infoUtils';
import EmbeddedAppsUtils from '@webex/plugin-meetings/src/locus-info/embeddedAppsUtils';
import LocusDeltaParser from '@webex/plugin-meetings/src/locus-info/parser';
import Metrics from '@webex/plugin-meetings/src/metrics';

import {
  LOCUSINFO,
  RECORDING_STATE,
  LOCUSEVENT,
  EVENTS,
  DISPLAY_HINTS,
  _CALL_,
  LOCUS,
  MEETING_STATE,
  _MEETING_,
} from '../../../../src/constants';

import {self, selfWithInactivity} from './selfConstant';

describe('plugin-meetings', () => {
  describe('LocusInfo index', () => {
    let mockMeeting;
    const updateMeeting = (object) => {
      if (mockMeeting && object && Object.keys(object).length) {
        Object.keys(object).forEach((key) => {
          mockMeeting[key] = object[key];
        });
      }
    };
    const locus = {};
    const meetingId = 'meetingId';
    let locusInfo;
    let sendBehavioralMetricStub;

    const webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    beforeEach(() => {
      mockMeeting = {};
      locusInfo = new LocusInfo(updateMeeting, webex, meetingId);

      locusInfo.init(locus);

      locusInfo.parsedLocus = {
        states: [{one: 'one'}],
        fullState: {type: 'MEETING'},
        info: {
          sipUri: 'abc@webex.com',
          isUnlocked: true,
          isLocked: false,
          displayHints: {
            joined: ['ROSTER_IN_MEETING', 'LOCK_STATUS_UNLOCKED'],
            moderator: [],
          },
        },
      };

      sendBehavioralMetricStub = sinon.stub(Metrics, 'sendBehavioralMetric');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#updateControls', () => {
      let newControls;

      beforeEach('setup new controls', () => {
        newControls = {
          disallowUnmute: {enabled: true},
          lock: {},
          meetingFull: {},
          muteOnEntry: {enabled: true},
          raiseHand: {enabled: true},
          reactions: {enabled: true, showDisplayNameWithReactions: true},
          record: {
            recording: false,
            paused: false,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {control: 'example-value'},
          transcribe: {},
          viewTheParticipantList: {enabled: true},
          meetingContainer: {
            meetingContainerUrl: 'http://new-url.com',
          },
          entryExitTone: {enabled: true, mode: 'foo'},
          video: {enabled: true},
        };
      });

      afterEach(() => {
        newControls = null;
      });

      it('should update the controls object', () => {
        locusInfo.updateControls(newControls);

        assert.equal(locusInfo.controls, newControls);
      });

      it('should trigger the CONTROLS_MUTE_ON_ENTRY_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_MUTE_ON_ENTRY_CHANGED,
          {state: newControls.muteOnEntry}
        );
      });

      it('should trigger the CONTROLS_SHARE_CONTROL_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_SHARE_CONTROL_CHANGED,
          {state: newControls.shareControl}
        );
      });

      it('should trigger the CONTROLS_DISALLOW_UNMUTE_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_DISALLOW_UNMUTE_CHANGED,
          {state: newControls.disallowUnmute}
        );
      });

      it('should trigger the CONTROLS_REACTIONS_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_REACTIONS_CHANGED,
          {state: newControls.reactions}
        );
      });

      it('should trigger the CONTROLS_VIEW_THE_PARTICIPANTS_LIST_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_VIEW_THE_PARTICIPANTS_LIST_CHANGED,
          {state: newControls.viewTheParticipantList}
        );
      });

      it('should trigger the CONTROLS_RAISE_HAND_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_RAISE_HAND_CHANGED,
          {state: newControls.raiseHand}
        );
      });

      it('should trigger the CONTROLS_VIDEO_CHANGED event when necessary', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_VIDEO_CHANGED,
          {state: newControls.video}
        );
      });

      it('should not trigger the CONTROLS_RECORDING_UPDATED event', () => {
        locusInfo.controls = {};
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        locusInfo.emitScoped.getCalls().forEach((x) => {
          // check that no calls in emitScoped are for CONTROLS_RECORDING_UPDATED
          assert.notEqual(x.args[1], LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED);
        });
      });

      it('should keep the recording state to `IDLE`', () => {
        locusInfo.controls = {
          record: {
            recording: true,
            paused: false,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {},
        };
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state: RECORDING_STATE.IDLE,
            modifiedBy: 'George Kittle',
            lastModified: 'TODAY',
          }
        );
      });

      it('should update the recording state to `RECORDING`', () => {
        locusInfo.controls = {
          lock: {},
          meetingFull: {},
          record: {
            recording: false,
            paused: false,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {},
        };
        newControls.record.recording = true;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state: RECORDING_STATE.RECORDING,
            modifiedBy: 'George Kittle',
            lastModified: 'TODAY',
          }
        );
      });

      it('should update the recording state to `PAUSED`', () => {
        locusInfo.emitScoped = sinon.stub();
        locusInfo.controls = {
          lock: {},
          meetingFull: {},
          record: {
            recording: false,
            paused: false,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {},
        };
        newControls.record.paused = true;
        newControls.record.recording = true;
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state: RECORDING_STATE.PAUSED,
            modifiedBy: 'George Kittle',
            lastModified: 'TODAY',
          }
        );
      });

      it('should update the recording state to `RESUMED`', () => {
        locusInfo.emitScoped = sinon.stub();
        locusInfo.controls = {
          lock: {},
          meetingFull: {},
          record: {
            recording: false,
            paused: true,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {},
        };
        // there must be a recording to be paused/resumed
        newControls.record.recording = true;
        newControls.record.paused = false;
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state: RECORDING_STATE.RESUMED,
            modifiedBy: 'George Kittle',
            lastModified: 'TODAY',
          }
        );
      });

      it('should update the recording state to `IDLE` even if `pause`status changes', () => {
        locusInfo.emitScoped = sinon.stub();
        locusInfo.controls = {
          lock: {},
          meetingFull: {},
          record: {
            recording: true,
            paused: true,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {},
        };
        newControls.record.recording = false;
        newControls.record.paused = false;
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state: RECORDING_STATE.IDLE,
            modifiedBy: 'George Kittle',
            lastModified: 'TODAY',
          }
        );
      });

      it('should update the breakout state', () => {
        locusInfo.emitScoped = sinon.stub();
        let tmpStub = sinon.stub(SelfUtils, 'getReplacedBreakoutMoveId').returns('breakoutMoveId');
        newControls.breakout = {breakout: {}};
        let selfInfo = {};

        locusInfo.updateControls(newControls, selfInfo);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_BREAKOUT_UPDATED,
          {
            breakout: newControls.breakout,
          }
        );
        tmpStub.restore();
      });

      it('should update the interpretation state', () => {
        locusInfo.emitScoped = sinon.stub();
        newControls.interpretation = {siLanguages: [{languageCode: 20, languageName: 'en'}]};
        let selfInfo = {};

        locusInfo.updateControls(newControls, selfInfo);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_INTERPRETATION_UPDATED,
          {
            interpretation: newControls.interpretation,
          }
        );
      });

      it('should update the transcript state', () => {
        locusInfo.emitScoped = sinon.stub();
        locusInfo.controls = {
          lock: {},
          meetingFull: {},
          record: {
            recording: false,
            paused: true,
            meta: {
              lastModified: 'TODAY',
              modifiedBy: 'George Kittle',
            },
          },
          shareControl: {},
          transcribe: {
            transcribing: false,
            caption: false,
          },
        };
        newControls.transcribe.transcribing = true;
        newControls.transcribe.caption = true;

        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_TRANSCRIBE_UPDATED,
          {
            transcribing: true,
            caption: true,
          }
        );
      });

      it('should update the manual caption state', () => {
        locusInfo.emitScoped = sinon.stub();
        locusInfo.controls = {
          manualCaptionControl: {enabled: false},
        };

        locusInfo.updateControls({manualCaptionControl: { enabled: true, }});

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_MANUAL_CAPTION_UPDATED,
          {
            enabled: true,
          }
        );
      });

      it('should update the meetingContainerURL from null', () => {
        locusInfo.controls = {
          meetingContainer: {meetingContainerUrl: null},
        };

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
          {meetingContainerUrl: 'http://new-url.com'}
        );
      });

      it('should update the meetingContainerURL from not null', () => {
        locusInfo.controls = {
          meetingContainer: {meetingContainerUrl: 'http://old-url.com'},
        };

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
          {meetingContainerUrl: 'http://new-url.com'}
        );
      });

      it('should update the meetingContainerURL from missing', () => {
        locusInfo.controls = {};

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
          {meetingContainerUrl: 'http://new-url.com'}
        );
      });

      it('should update the entryExitTone when changed', () => {
        locusInfo.controls = {};

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_ENTRY_EXIT_TONE_UPDATED,
          {entryExitTone: 'foo'}
        );
      });

      it('should not update the entryExitTone when unchanged', () => {
        locusInfo.controls = {entryExitTone: {enabled: true, mode: 'foo'}};

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        locusInfo.emitScoped.getCalls().forEach((x) => {
          // check that no calls in emitScoped are for CONTROLS_ENTRY_EXIT_TONE_UPDATED
          assert.notEqual(x.args[1], LOCUSINFO.EVENTS.CONTROLS_ENTRY_EXIT_TONE_UPDATED);
        });
      });

      it('should update videoEnabled when changed', () => {
        locusInfo.controls = {};

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
          {unmuteAllowed: true}
        );

        assert.equal(mockMeeting.unmuteVideoAllowed, true);
      });

      it('should not update videoEnabled when unchanged', () => {
        locusInfo.controls = {videoEnabled: true};

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateControls(newControls);

        locusInfo.emitScoped.getCalls().forEach((x) => {
          // check that no calls in emitScoped are for SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED
          assert.notEqual(x.args[1], LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED);
        });

        assert.equal(mockMeeting.unmuteVideoAllowed, undefined);
      });
    });

    describe('#updateParticipants()', () => {
      let newParticipants;

      beforeEach('setup new participants', () => {
        newParticipants = [
          {
            person: {
              id: 1234,
            },
            status: {
              audioStatus: 'testValue',
              videoSlidesStatus: 'testValue',
              videoStatus: 'testValue',
            },
          },
        ];
      });

      it('should assert that the correct recordingId, selfIdentity, selfId, and hostId are being set and emitted from updateParticipants', () => {
        locusInfo.parsedLocus = {
          controls: {
            record: {
              modifiedBy: '1',
            },
          },
          self: {
            selfIdentity: '123',
            selfId: '2',
          },
          host: {
            hostId: '3',
          },
        };
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateParticipants({});

        // if this assertion fails, double-check the attributes used in
        // the updateParticipants function in locus-info/index.js
        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateParticipants',
          },
          EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS,
          {
            participants: {},
            recordingId: '1',
            selfIdentity: '123',
            selfId: '2',
            hostId: '3',
            isReplace: undefined,
          }
        );
        // note: in a real use case, recordingId, selfId, and hostId would all be the same
        // for this specific test, we are double-checking that each of the id's
        // are being correctly grabbed from locusInfo.parsedLocus within updateParticipants
      });

      it('should call with breakout control info', () => {
        locusInfo.parsedLocus = {
          controls: {
            record: {
              modifiedBy: '1',
            },
          },
          self: {
            selfIdentity: '123',
            selfId: '2',
          },
          host: {
            hostId: '3',
          },
        };

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateParticipants({}, true);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateParticipants',
          },
          EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS,
          {
            participants: {},
            recordingId: '1',
            selfIdentity: '123',
            selfId: '2',
            hostId: '3',
            isReplace: true,
          }
        );
      });

      it('should update the deltaParticipants object', () => {
        const prev = locusInfo.deltaParticipants;

        locusInfo.updateParticipantDeltas(newParticipants);

        assert.notEqual(locusInfo.deltaParticipants, prev);
      });

      it('should update the delta property on all changed states', () => {
        locusInfo.updateParticipantDeltas(newParticipants);

        const [exampleParticipant] = locusInfo.deltaParticipants;

        assert.isTrue(exampleParticipant.delta.audioStatus);
        assert.isTrue(exampleParticipant.delta.videoSlidesStatus);
        assert.isTrue(exampleParticipant.delta.videoStatus);
      });

      it('should include the person details of the changed participant', () => {
        locusInfo.updateParticipantDeltas(newParticipants);

        const [exampleParticipant] = locusInfo.deltaParticipants;

        assert.equal(exampleParticipant.person, newParticipants[0].person);
      });

      it('should clear deltaParticipants when no changes occured', () => {
        locusInfo.participants = [...newParticipants];

        locusInfo.updateParticipantDeltas(locusInfo.participants);

        assert.isTrue(locusInfo.deltaParticipants.length === 0);
      });
    });

    describe('#updateSelf', () => {
      it('should trigger CONTROLS_MEETING_LAYOUT_UPDATED when the meeting layout controls change', () => {
        const layoutType = 'EXAMPLE TYPE';

        locusInfo.self = undefined;
        const selfWithLayoutChanged = cloneDeep(self);

        selfWithLayoutChanged.controls.layouts = [
          {
            type: layoutType,
          },
        ];

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithLayoutChanged, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED,
          {layout: layoutType}
        );
      });

      it('should not trigger CONTROLS_MEETING_LAYOUT_UPDATED when the meeting layout controls did not change', () => {
        const layoutType = 'EXAMPLE TYPE';

        locusInfo.self = undefined;
        const selfWithLayoutChanged = cloneDeep(self);

        selfWithLayoutChanged.controls.layouts = [
          {
            type: layoutType,
          },
        ];

        // Set the layout prior to stubbing to validate it does not change.
        locusInfo.updateSelf(selfWithLayoutChanged, []);

        locusInfo.emitScoped = sinon.stub();

        locusInfo.updateSelf(selfWithLayoutChanged, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED,
          {layout: layoutType}
        );
      });

      it('should trigger MEDIA_INACTIVITY on server media inactivity', () => {
        locusInfo.self = self;

        locusInfo.webex.internal.device.url = selfWithInactivity.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithInactivity, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.MEDIA_INACTIVITY,
          SelfUtils.getMediaStatus(selfWithInactivity.mediaSessions)
        );
      });

      it('should trigger SELF_REMOTE_MUTE_STATUS_UPDATED when muted on entry', () => {
        // usually "previous self" is just undefined when we get first self from locus with remote mute
        locusInfo.self = undefined;
        const selfWithMutedByOthers = cloneDeep(self);

        selfWithMutedByOthers.controls.audio.muted = true;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithMutedByOthers, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {muted: true, unmuteAllowed: true}
        );

        // but sometimes "previous self" is defined, but without controls.audio.muted, so we test this here:
        locusInfo.self = cloneDeep(self);
        locusInfo.self.controls.audio = {};

        locusInfo.updateSelf(selfWithMutedByOthers, []);
        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {muted: true, unmuteAllowed: true}
        );
      });

      it('should not trigger SELF_REMOTE_MUTE_STATUS_UPDATED when not muted on entry', () => {
        locusInfo.self = undefined;
        const selfWithMutedByOthersFalse = cloneDeep(self);

        selfWithMutedByOthersFalse.controls.audio.muted = false;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithMutedByOthersFalse, []);

        // we might get some calls to emitScoped, but we need to check that none of them are for SELF_REMOTE_MUTE_STATUS_UPDATED
        locusInfo.emitScoped.getCalls().forEach((x) => {
          assert.notEqual(x.args[1], LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED);
        });
      });

      it('should not trigger SELF_REMOTE_MUTE_STATUS_UPDATED when being removed from meeting', () => {
        const selfWithMutedByOthers = cloneDeep(self);

        selfWithMutedByOthers.controls.audio.muted = true;

        locusInfo.self = selfWithMutedByOthers;

        // when user gets removed from meeting we receive a Locus DTO without any self.controls
        const selfWithoutControls = cloneDeep(self);

        selfWithoutControls.controls = undefined;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithoutControls, []);

        // we might get some calls to emitScoped, but we need to check that none of them are for SELF_REMOTE_MUTE_STATUS_UPDATED
        locusInfo.emitScoped.getCalls().forEach((x) => {
          assert.notEqual(x.args[1], LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED);
        });
      });

      it('should trigger SELF_REMOTE_MUTE_STATUS_UPDATED on othersMuted', () => {
        locusInfo.self = self;
        const selfWithMutedByOthers = cloneDeep(self);

        selfWithMutedByOthers.controls.audio.muted = true;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithMutedByOthers, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {muted: true, unmuteAllowed: true}
        );
      });

      describe('SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED', () => {
        it('should emit event when video muted on entry', () => {
          // usually "previous self" is just undefined when we get first self from locus
          locusInfo.self = undefined;
          const selfWithMutedByOthers = cloneDeep(self);

          // remoteVideoMuted
          selfWithMutedByOthers.controls.video.muted = true;

          locusInfo.webex.internal.device.url = self.deviceUrl;
          locusInfo.emitScoped = sinon.stub();
          locusInfo.updateSelf(selfWithMutedByOthers, []);

          assert.calledWith(
            locusInfo.emitScoped,
            {
              file: 'locus-info',
              function: 'updateSelf',
            },
            LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
            {muted: true}
          );

          // but sometimes "previous self" is defined, but without controls.audio.muted, so we test this here:
          locusInfo.self = cloneDeep(self);
          locusInfo.self.controls.video = {};

          locusInfo.updateSelf(selfWithMutedByOthers, []);
          assert.calledWith(
            locusInfo.emitScoped,
            {
              file: 'locus-info',
              function: 'updateSelf',
            },
            LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
            {muted: true}
          );
        });

        it('should not emit event when not muted on entry', () => {
          locusInfo.self = undefined;
          const selfWithMutedByOthersFalse = cloneDeep(self);

          selfWithMutedByOthersFalse.controls.video.muted = false;

          locusInfo.webex.internal.device.url = self.deviceUrl;
          locusInfo.emitScoped = sinon.stub();
          locusInfo.updateSelf(selfWithMutedByOthersFalse, []);

          // we might get some calls to emitScoped, but we need to check that none of them are for SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED
          locusInfo.emitScoped.getCalls().forEach((x) => {
            assert.notEqual(x.args[1], LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED);
          });
        });

        it('should emit event when remoteVideoMuted changed', () => {
          locusInfo.self = self;
          const selfWithMutedByOthers = cloneDeep(self);

          selfWithMutedByOthers.controls.video.muted = true;

          locusInfo.webex.internal.device.url = self.deviceUrl;
          locusInfo.emitScoped = sinon.stub();
          locusInfo.updateSelf(selfWithMutedByOthers, []);

          assert.calledWith(
            locusInfo.emitScoped,
            {
              file: 'locus-info',
              function: 'updateSelf',
            },
            LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
            {muted: true}
          );
        });
      });

      it('should trigger SELF_MEETING_BREAKOUTS_CHANGED when breakouts changed', () => {
        locusInfo.self = self;
        const selfWithBreakoutsChanged = cloneDeep(self);

        selfWithBreakoutsChanged.controls.breakout.sessions.active[0].name = 'new name';

        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithBreakoutsChanged, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MEETING_BREAKOUTS_CHANGED,
          {
            breakoutSessions: {
              active: [
                {
                  name: 'new name',
                  groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                  sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                  sessionType: 'BREAKOUT',
                },
              ],
              allowed: [
                {
                  name: 'Breakout session 2',
                  groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                  sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                  sessionType: 'BREAKOUT',
                },
              ],
            },
          }
        );
      });

      it('should trigger SELF_REMOTE_MUTE_STATUS_UPDATED if muted and disallowUnmute changed', () => {
        locusInfo.self = self;
        const selfWithMutedByOthersAndDissalowUnmute = cloneDeep(self);

        // first simulate remote mute
        selfWithMutedByOthersAndDissalowUnmute.controls.audio.muted = true;
        selfWithMutedByOthersAndDissalowUnmute.controls.audio.disallowUnmute = true;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithMutedByOthersAndDissalowUnmute, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {muted: true, unmuteAllowed: false}
        );

        // now change only disallowUnmute
        const selfWithMutedByOthers = cloneDeep(self);

        selfWithMutedByOthers.controls.audio.muted = true;
        selfWithMutedByOthers.controls.audio.disallowUnmute = false;

        locusInfo.updateSelf(selfWithMutedByOthers, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {muted: true, unmuteAllowed: true}
        );
      });

      it('should trigger LOCAL_UNMUTE_REQUIRED on localAudioUnmuteRequired', () => {
        locusInfo.self = self;
        const selfWithLocalUnmuteRequired = cloneDeep(self);

        selfWithLocalUnmuteRequired.controls.audio.muted = false;
        selfWithLocalUnmuteRequired.controls.audio.localAudioUnmuteRequired = true;

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithLocalUnmuteRequired, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUIRED,
          {
            muted: false,
            unmuteAllowed: true,
          }
        );
      });

      it('should trigger LOCAL_UNMUTE_REQUESTED when receiving requestedToUnmute=true', () => {
        locusInfo.self = self;
        const selfWithRequestedToUnmute = cloneDeep(self);

        selfWithRequestedToUnmute.controls.audio.requestedToUnmute = true;
        selfWithRequestedToUnmute.controls.audio.lastModifiedRequestedToUnmute =
          '2023-06-16T19:25:04.369Z';

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateSelf(selfWithRequestedToUnmute, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED,
          {}
        );

        // now change requestedToUnmute back to false -> it should NOT trigger LOCAL_UNMUTE_REQUESTED
        const selfWithoutRequestedToUnmute = cloneDeep(selfWithRequestedToUnmute);

        selfWithoutRequestedToUnmute.controls.audio.requestedToUnmute = false;

        locusInfo.emitScoped.resetHistory();
        locusInfo.updateSelf(selfWithoutRequestedToUnmute, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED,
          {}
        );
      });

      it('should trigger SELF_OBSERVING when moving meeting to DX', () => {
        locusInfo.self = self;
        const selfInitiatedMove = cloneDeep(self);

        // Inital move meeting is iniated
        selfInitiatedMove.devices[0].intent.type = 'MOVE_MEDIA';

        locusInfo.webex.internal.device.url = self.deviceUrl;

        locusInfo.updateSelf(selfInitiatedMove, []);

        locusInfo.emitScoped = sinon.stub();
        // When dx joined the meeting after move
        const selfAfterDxJoins = cloneDeep(self);

        selfAfterDxJoins.devices[0].intent.type = 'OBSERVE';

        locusInfo.updateSelf(selfAfterDxJoins, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_OBSERVING
        );
      });

      it('should not trigger SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE when not updated', () => {
        const selfClone = cloneDeep(self);

        selfClone.canNotViewTheParticipantList = false; // same

        // Set the layout prior to stubbing to validate it does not change.
        locusInfo.updateSelf(self, []);

        locusInfo.emitScoped = sinon.stub();

        locusInfo.updateSelf(selfClone, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE,
          {canNotViewTheParticipantList: false}
        );
      });

      it('should trigger SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE when updated', () => {
        const selfClone = cloneDeep(self);

        selfClone.canNotViewTheParticipantList = true; // different

        // Set the layout prior to stubbing to validate it does not change.
        locusInfo.updateSelf(self, []);

        locusInfo.emitScoped = sinon.stub();

        locusInfo.updateSelf(selfClone, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE,
          {canNotViewTheParticipantList: true}
        );
      });

      it('should not trigger SELF_IS_SHARING_BLOCKED_CHANGE when not updated', () => {
        const selfClone = cloneDeep(self);

        selfClone.isSharingBlocked = false; // same

        // Set the layout prior to stubbing to validate it does not change.
        locusInfo.updateSelf(self, []);

        locusInfo.emitScoped = sinon.stub();

        locusInfo.updateSelf(selfClone, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_IS_SHARING_BLOCKED_CHANGE,
          {isSharingBlocked: false}
        );
      });

      it('should trigger SELF_IS_SHARING_BLOCKED_CHANGE when updated', () => {
        const selfClone = cloneDeep(self);

        selfClone.isSharingBlocked = true; // different

        // Set the layout prior to stubbing to validate it does not change.
        locusInfo.updateSelf(self, []);

        locusInfo.emitScoped = sinon.stub();

        locusInfo.updateSelf(selfClone, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_IS_SHARING_BLOCKED_CHANGE,
          {isSharingBlocked: true}
        );
      });

      it('should trigger SELF_ROLES_CHANGED if self roles changed', () => {
        locusInfo.self = self;
        locusInfo.emitScoped = sinon.stub();
        const sampleNewSelf = cloneDeep(self);
        sampleNewSelf.controls.role.roles = [{type: 'COHOST', hasRole: true}];

        locusInfo.updateSelf(sampleNewSelf, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_ROLES_CHANGED,
          {oldRoles: ['PRESENTER'], newRoles: ['COHOST']}
        );
      });

      it('should not trigger SELF_ROLES_CHANGED if self roles not changed', () => {
        locusInfo.self = self;
        locusInfo.emitScoped = sinon.stub();
        const sampleNewSelf = cloneDeep(self);
        sampleNewSelf.controls.role.roles = [{type: 'PRESENTER', hasRole: true}];

        locusInfo.updateSelf(sampleNewSelf, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_ROLES_CHANGED,
          {oldRoles: ['PRESENTER'], newRoles: ['PRESENTER']}
        );
      });

      it('should trigger SELF_MEETING_INTERPRETATION_CHANGED if self interpretation info changed', () => {
        locusInfo.self = self;
        locusInfo.emitScoped = sinon.stub();
        const sampleNewSelf = cloneDeep(self);
        sampleNewSelf.controls.interpretation.targetLanguage = 'it';

        locusInfo.updateSelf(sampleNewSelf, []);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MEETING_INTERPRETATION_CHANGED,
          {
            interpretation: sampleNewSelf.controls.interpretation,
            selfParticipantId: self.id,
          }
        );
      });

      it('should not trigger SELF_MEETING_INTERPRETATION_CHANGED if self interpretation info not changed', () => {
        locusInfo.self = self;
        locusInfo.emitScoped = sinon.stub();
        const sampleNewSelf = cloneDeep(self);
        sampleNewSelf.controls.interpretation.targetLanguage = 'cn'; // same with previous one

        locusInfo.updateSelf(sampleNewSelf, []);

        assert.neverCalledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MEETING_INTERPRETATION_CHANGED,
          {
            interpretation: sampleNewSelf.controls.interpretation,
            selfParticipantId: self.id,
          }
        );
      });
    });

    describe('#updateMeetingInfo', () => {
      let meetingInfo;
      let getInfosSpy;
      let getRolesSpy;
      let isJoinedSpy;

      beforeEach('setup meeting info', () => {
        meetingInfo = {
          displayHints: {
            joined: ['ROSTER_IN_MEETING', 'LOCK_STATUS_UNLOCKED'],
            moderator: [],
          },
        };
        getInfosSpy = sinon.spy(InfoUtils, 'getInfos');
        getRolesSpy = sinon.spy(SelfUtils, 'getRoles');
        isJoinedSpy = sinon.spy(SelfUtils, 'isJoined');
      });

      afterEach(() => {
        getRolesSpy.restore();
        getInfosSpy.restore();
        isJoinedSpy.restore();
      });

      it('should trigger MEETING_LOCKED/UNLOCKED when meeting gets locked/unlocked', () => {
        const meetingInfoLocked = cloneDeep(meetingInfo);

        const idx = meetingInfoLocked.displayHints.joined.indexOf('LOCK_STATUS_UNLOCKED');

        if (idx !== -1) {
          meetingInfoLocked.displayHints.joined[idx] = 'LOCK_STATUS_LOCKED';
        }

        locusInfo.webex.internal.device.url = self.deviceUrl;
        locusInfo.emitScoped = sinon.stub();
        locusInfo.updateMeetingInfo(meetingInfoLocked, self);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_LOCKED,
          meetingInfoLocked
        );

        // now unlock the meeting and verify that we get the right event
        const meetingInfoUnlocked = cloneDeep(meetingInfo); // meetingInfo already is "unlocked"

        locusInfo.updateMeetingInfo(meetingInfoUnlocked, self);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_UNLOCKED,
          meetingInfoUnlocked
        );
      });

      const checkMeetingInfoUpdatedCalled = (expected, payload) => {
        const expectedArgs = [
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_INFO_UPDATED,
          payload,
        ];

        if (expected) {
          assert.calledWith(...expectedArgs);
        } else {
          assert.neverCalledWith(...expectedArgs);
        }
        locusInfo.emitScoped.resetHistory();
      };

      const checkMeetingInfoUpdatedCalledForRoles = (expected, payload) => {
        const expectedArgs = [
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_INFO_UPDATED,
          payload,
        ];

        if (expected) {
          assert.calledWith(...expectedArgs);
        } else {
          assert.neverCalledWith(...expectedArgs);
        }
        locusInfo.emitScoped.resetHistory();
      };

      it('emits MEETING_INFO_UPDATED and updates the meeting if the info changes', () => {
        const initialInfo = cloneDeep(meetingInfo);

        let expectedMeeting;

        /*
        When the event is triggered, it is required that the meeting has already
        been updated. This is why the meeting is being checked within the stubbed event emitter
        */
        sinon.stub(locusInfo, 'emitScoped').callsFake(() => {
          assert.deepEqual(mockMeeting, expectedMeeting);
        });

        // set the info initially as locusInfo.info starts as undefined
        expectedMeeting = {
          coHost: {
            LOWER_SOMEONE_ELSES_HAND: true,
          },
          isLocked: false,
          isUnlocked: true,
          moderator: {
            LOWER_SOMEONE_ELSES_HAND: true,
          },
          policy: {
            LOCK_STATUS_UNLOCKED: true,
            ROSTER_IN_MEETING: true,
          },
          userDisplayHints: ['ROSTER_IN_MEETING', 'LOCK_STATUS_UNLOCKED'],
        };
        locusInfo.updateMeetingInfo(initialInfo, self);

        // since it was initially undefined, this should trigger the event

        checkMeetingInfoUpdatedCalled(true, {isInitializing: false});

        const newInfo = cloneDeep(meetingInfo);

        newInfo.displayHints.coHost = [DISPLAY_HINTS.LOCK_CONTROL_LOCK];

        // Updating with different info should trigger the event
        expectedMeeting = {
          coHost: {
            LOWER_SOMEONE_ELSES_HAND: true,
            LOCK_CONTROL_LOCK: true,
          },
          isLocked: false,
          isUnlocked: true,
          moderator: {
            LOWER_SOMEONE_ELSES_HAND: true,
          },
          policy: {
            LOCK_STATUS_UNLOCKED: true,
            ROSTER_IN_MEETING: true,
          },
          userDisplayHints: ['ROSTER_IN_MEETING', 'LOCK_STATUS_UNLOCKED'],
        };
        locusInfo.updateMeetingInfo(newInfo, self);

        checkMeetingInfoUpdatedCalled(true, {isInitializing: false});

        // update it with the same info
        expectedMeeting = {
          coHost: {
            LOWER_SOMEONE_ELSES_HAND: true,
            LOCK_CONTROL_LOCK: true,
          },
          isLocked: false,
          isUnlocked: true,
          moderator: {
            LOWER_SOMEONE_ELSES_HAND: true,
          },
          policy: {
            LOCK_STATUS_UNLOCKED: true,
            ROSTER_IN_MEETING: true,
          },
          userDisplayHints: ['ROSTER_IN_MEETING', 'LOCK_STATUS_UNLOCKED'],
        };
        locusInfo.updateMeetingInfo(newInfo, self);

        // since the info is the same it should not call trigger the event
        checkMeetingInfoUpdatedCalled(false, {isInitializing: false});

        // update it with the same info, but roles changed
        const updateSelf = cloneDeep(self);
        updateSelf?.controls?.role?.roles.push({
          type: 'COHOST',
          hasRole: true,
        });
        expectedMeeting = {
          coHost: {
            LOWER_SOMEONE_ELSES_HAND: true,
            LOCK_CONTROL_LOCK: true,
          },
          isLocked: false,
          isUnlocked: true,
          moderator: {
            LOWER_SOMEONE_ELSES_HAND: true,
          },
          policy: {
            LOCK_STATUS_UNLOCKED: true,
            ROSTER_IN_MEETING: true,
          },
          userDisplayHints: [
            'ROSTER_IN_MEETING',
            'LOCK_STATUS_UNLOCKED',
            'LOCK_CONTROL_LOCK',
            'LOWER_SOMEONE_ELSES_HAND',
          ],
        };
        locusInfo.updateMeetingInfo(newInfo, updateSelf);
        // since the info is the same but roles changed, it should call trigger the event
        checkMeetingInfoUpdatedCalledForRoles(true, {isInitializing: false});
      });

      it('gets roles from self if available', () => {
        const initialInfo = cloneDeep(meetingInfo);

        const parsedLocusInfo = cloneDeep(locusInfo.parsedLocus.info);

        locusInfo.updateMeetingInfo(initialInfo, self);

        assert.calledWith(getRolesSpy, self);
        assert.calledWith(getInfosSpy, parsedLocusInfo, initialInfo, ['PRESENTER']);
      });

      it('gets roles from parsedLocus if self not passed in', () => {
        const initialInfo = cloneDeep(meetingInfo);

        locusInfo.parsedLocus.self = {
          roles: ['MODERATOR', 'COHOST'],
        };

        sinon.stub(locusInfo, 'emitScoped');

        const parsedLocusInfo = cloneDeep(locusInfo.parsedLocus.info);

        locusInfo.updateMeetingInfo(initialInfo);
        assert.calledWith(isJoinedSpy, locusInfo.parsedLocus.self);
        assert.neverCalledWith(getRolesSpy, self);
        assert.calledWith(getInfosSpy, parsedLocusInfo, initialInfo, ['MODERATOR', 'COHOST']);

        // since self is not passed to updateMeetingInfo, MEETING_INFO_UPDATED should be triggered with isIntializing: true
        checkMeetingInfoUpdatedCalledForRoles(true, {isInitializing: true});
      });
    });

    describe('#updateEmbeddedApps()', () => {
      const newEmbeddedApps = [
        {
          url: 'https://hecate-b.wbx2.com/apps/api/v1/locus/7a4994a7',
          sequence: 138849877016800000,
          appId:
            'Y2lzY29zcGFyazovL3VzL0FQUExJQ0FUSU9OLzQxODc1MGQ0LTM3ZDctNGY2MC1hOWE3LWEwZTE1NDFhNjRkNg',
          instanceInfo: {
            appInstanceUrl:
              'https://webex.sli.do/participant/event/mFKKjcYxzx9h31eyWgngFS?clusterId=eu1',
            externalAppInstanceUrl: '',
            title: 'Active session',
          },
          state: 'STARTED',
          lastModified: '2022-10-13T21:01:41.680Z',
        },
      ];

      it('properly updates the meeting embeddedApps', () => {
        const prev = mockMeeting.embeddedApps;

        locusInfo.updateEmbeddedApps(newEmbeddedApps);

        assert.notEqual(mockMeeting.embeddedApps, prev);
        assert.isNotNull(mockMeeting.embeddedApps?.[0].type);
      });

      it("does not emit EMBEDDED_APPS_UPDATED when apps didn't change", () => {
        locusInfo.updateEmbeddedApps(newEmbeddedApps);

        locusInfo.emitScoped = sinon.stub();

        const clonedApps = cloneDeep(newEmbeddedApps);

        locusInfo.updateEmbeddedApps(clonedApps);

        assert.notCalled(locusInfo.emitScoped);
      });

      it('emits EMBEDDED_APPS_UPDATED when apps changed', () => {
        locusInfo.updateEmbeddedApps(newEmbeddedApps);

        locusInfo.emitScoped = sinon.stub();

        const clonedApps = cloneDeep(newEmbeddedApps);

        clonedApps[0].state = 'STOPPED';
        const expectedApps = EmbeddedAppsUtils.parse(clonedApps);

        locusInfo.updateEmbeddedApps(clonedApps);

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'updateEmbeddedApps',
          },
          LOCUSINFO.EVENTS.EMBEDDED_APPS_UPDATED,
          expectedApps
        );
      });
    });

    describe('#LocusDeltaEvents', () => {
      const fakeMeeting = 'fakeMeeting';
      let sandbox = null;
      let locusParser = null;
      let fakeLocus = null;

      beforeEach(() => {
        locusParser = locusInfo.locusParser;
        sandbox = sinon.createSandbox();

        fakeLocus = {
          meeting: true,
          participants: true,
          url: 'newLocusUrl',
          syncUrl: 'newSyncUrl',
        };
      });

      afterEach(() => {
        sandbox.restore();
        sandbox = null;
      });

      it('handles locus delta events', () => {
        sandbox.stub(locusInfo, 'handleLocusDelta');

        const data = {
          eventType: LOCUSEVENT.DIFFERENCE,
          locus: fakeLocus,
        };

        locusInfo.parse(fakeMeeting, data);

        assert.calledWith(locusInfo.handleLocusDelta, fakeLocus, fakeMeeting);
      });

      it('should queue delta event with internal locus parser', () => {
        sandbox.stub(locusParser, 'onDeltaEvent');

        const data = {
          eventType: LOCUSEVENT.DIFFERENCE,
          locus: fakeLocus,
        };

        locusInfo.parse(fakeMeeting, data);

        // queues locus delta event
        assert.calledWith(locusParser.onDeltaEvent, fakeLocus);
      });

      it('should assign a function to onDeltaAction', () => {
        sandbox.stub(locusParser, 'onDeltaEvent');
        assert.isNull(locusParser.onDeltaAction);

        locusInfo.handleLocusDelta(fakeLocus, fakeMeeting);

        assert.isFunction(locusParser.onDeltaAction);
      });

      it('#updateLocusInfo ignores breakout LEFT message', () => {
        const newLocus = {
          self: {
            reason: 'MOVED',
            state: 'LEFT',
          },
        };

        locusInfo.updateControls = sinon.stub();
        locusInfo.updateConversationUrl = sinon.stub();
        locusInfo.updateCreated = sinon.stub();
        locusInfo.updateFullState = sinon.stub();
        locusInfo.updateHostInfo = sinon.stub();
        locusInfo.updateMeetingInfo = sinon.stub();
        locusInfo.updateMediaShares = sinon.stub();
        locusInfo.updateParticipantsUrl = sinon.stub();
        locusInfo.updateReplace = sinon.stub();
        locusInfo.updateSelf = sinon.stub();
        locusInfo.updateLocusUrl = sinon.stub();
        locusInfo.updateAclUrl = sinon.stub();
        locusInfo.updateBasequence = sinon.stub();
        locusInfo.updateSequence = sinon.stub();
        locusInfo.updateMemberShip = sinon.stub();
        locusInfo.updateIdentifiers = sinon.stub();
        locusInfo.updateEmbeddedApps = sinon.stub();
        locusInfo.compareAndUpdate = sinon.stub();

        locusInfo.updateLocusInfo(newLocus);

        assert.notCalled(locusInfo.updateControls);
        assert.notCalled(locusInfo.updateConversationUrl);
        assert.notCalled(locusInfo.updateCreated);
        assert.notCalled(locusInfo.updateFullState);
        assert.notCalled(locusInfo.updateHostInfo);
        assert.notCalled(locusInfo.updateMeetingInfo);
        assert.notCalled(locusInfo.updateMediaShares);
        assert.notCalled(locusInfo.updateParticipantsUrl);
        assert.notCalled(locusInfo.updateReplace);
        assert.notCalled(locusInfo.updateSelf);
        assert.notCalled(locusInfo.updateLocusUrl);
        assert.notCalled(locusInfo.updateAclUrl);
        assert.notCalled(locusInfo.updateBasequence);
        assert.notCalled(locusInfo.updateSequence);
        assert.notCalled(locusInfo.updateMemberShip);
        assert.notCalled(locusInfo.updateIdentifiers);
        assert.notCalled(locusInfo.updateEmbeddedApps);
        assert.notCalled(locusInfo.compareAndUpdate);
      });

      it('onFullLocus() updates the working-copy of locus parser', () => {
        const eventType = 'fakeEvent';

        sandbox.stub(locusInfo, 'updateParticipantDeltas');
        sandbox.stub(locusInfo, 'updateLocusInfo');
        sandbox.stub(locusInfo, 'updateParticipants');
        sandbox.stub(locusInfo, 'isMeetingActive');
        sandbox.stub(locusInfo, 'handleOneOnOneEvent');
        sandbox.stub(locusParser, 'isNewFullLocus').returns(true);

        locusInfo.onFullLocus(fakeLocus, eventType);

        assert.equal(fakeLocus, locusParser.workingCopy);
      });

      it('onFullLocus() does not do anything if the incoming full locus DTO is old', () => {
        const eventType = 'fakeEvent';

        locusParser.workingCopy = {};

        const oldWorkingCopy = locusParser.workingCopy;

        const spies = [
          sandbox.stub(locusInfo, 'updateParticipantDeltas'),
          sandbox.stub(locusInfo, 'updateLocusInfo'),
          sandbox.stub(locusInfo, 'updateParticipants'),
          sandbox.stub(locusInfo, 'isMeetingActive'),
          sandbox.stub(locusInfo, 'handleOneOnOneEvent'),
        ];

        sandbox.stub(locusParser, 'isNewFullLocus').returns(false);

        locusInfo.onFullLocus(fakeLocus, eventType);

        spies.forEach((spy) => {
          assert.notCalled(spy);
        });

        assert.equal(oldWorkingCopy, locusParser.workingCopy);
      });

      it('onDeltaAction applies locus delta data to meeting', () => {
        const action = 'fake action';
        const parsedLoci = 'fake loci';

        sandbox.stub(locusParser, 'onDeltaEvent');
        locusInfo.handleLocusDelta(fakeLocus, fakeMeeting);
        sandbox.spy(locusInfo, 'applyLocusDeltaData');

        locusParser.onDeltaAction(action, parsedLoci);

        assert.calledWith(locusInfo.applyLocusDeltaData, action, parsedLoci, fakeMeeting);
      });

      it('applyLocusDeltaData handles USE_INCOMING action correctly', () => {
        const {USE_INCOMING} = LocusDeltaParser.loci;
        const meeting = {
          locusInfo: {
            onDeltaLocus: sandbox.stub(),
          },
        };

        locusInfo.applyLocusDeltaData(USE_INCOMING, fakeLocus, meeting);

        assert.calledWith(meeting.locusInfo.onDeltaLocus, fakeLocus);
      });

      it('applyLocusDeltaData gets delta locus on DESYNC action if we have a syncUrl', () => {
        const {DESYNC} = LocusDeltaParser.loci;
        const fakeDeltaLocus = {id: 'fake delta locus'};
        const meeting = {
          meetingRequest: {
            getLocusDTO: sandbox.stub().resolves({body: fakeDeltaLocus}),
          },
          locusInfo: {
            handleLocusDelta: sandbox.stub(),
          },
          locusUrl: 'oldLocusUrl',
        };

        locusInfo.locusParser.workingCopy = {
          syncUrl: 'oldSyncUrl',
        };

        // Since we have a promise inside a function we want to test that's not returned,
        // we will wait and stub it's last function to resolve this waiting promise.
        // Also ensures .handleLocusDelta() is called before .resume()
        return new Promise((resolve) => {
          locusInfo.locusParser.resume = sandbox.stub().callsFake(() => resolve());
          locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
        }).then(() => {
          assert.calledOnceWithExactly(meeting.meetingRequest.getLocusDTO, {url: 'oldSyncUrl'});

          assert.calledOnceWithExactly(meeting.locusInfo.handleLocusDelta, fakeDeltaLocus, meeting);
          assert.calledOnce(locusInfo.locusParser.resume);
        });
      });

      it('applyLocusDeltaData gets delta locus on DESYNC action if we have a syncUrl (empty response body)', () => {
        const {DESYNC} = LocusDeltaParser.loci;
        const meeting = {
          meetingRequest: {
            getLocusDTO: sandbox.stub().resolves({body: {}}),
          },
          locusInfo: {
            handleLocusDelta: sandbox.stub(),
            onFullLocus: sandbox.stub(),
          },
          locusUrl: 'oldLocusUrl',
        };

        locusInfo.locusParser.workingCopy = {
          syncUrl: 'oldSyncUrl',
        };

        // Since we have a promise inside a function we want to test that's not returned,
        // we will wait and stub it's last function to resolve this waiting promise.
        return new Promise((resolve) => {
          locusInfo.locusParser.resume = sandbox.stub().callsFake(() => resolve());
          locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
        }).then(() => {
          assert.calledOnceWithExactly(meeting.meetingRequest.getLocusDTO, {url: 'oldSyncUrl'});

          assert.notCalled(meeting.locusInfo.handleLocusDelta);
          assert.notCalled(meeting.locusInfo.onFullLocus);
          assert.calledOnce(locusInfo.locusParser.resume);
        });
      });

      it('applyLocusDeltaData gets full locus on DESYNC action if we do not have a syncUrl', () => {
        const {DESYNC} = LocusDeltaParser.loci;
        const fakeFullLocusDto = {id: 'fake full locus dto'};
        const meeting = {
          meetingRequest: {
            getLocusDTO: sandbox.stub().resolves({body: fakeFullLocusDto}),
          },
          locusInfo: {
            onFullLocus: sandbox.stub(),
          },
          locusUrl: 'oldLocusUrl',
        };

        locusInfo.locusParser.workingCopy = {}; // no syncUrl

        // Since we have a promise inside a function we want to test that's not returned,
        // we will wait and stub it's last function to resolve this waiting promise.
        // Also ensures .onFullLocus() is called before .resume()
        return new Promise((resolve) => {
          locusInfo.locusParser.resume = sandbox.stub().callsFake(() => resolve());
          locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
        }).then(() => {
          assert.calledOnceWithExactly(meeting.meetingRequest.getLocusDTO, {url: 'oldLocusUrl'});

          assert.calledOnceWithExactly(meeting.locusInfo.onFullLocus, fakeFullLocusDto);
          assert.calledOnce(locusInfo.locusParser.resume);
        });
      });

      it('applyLocusDeltaData handles LOCUS_URL_CHANGED action correctly', () => {
        const {LOCUS_URL_CHANGED} = LocusDeltaParser.loci;
        const fakeDeltaLocus = {id: 'fake delta locus'};
        const meeting = {
          meetingRequest: {
            getLocusDTO: sandbox.stub().resolves({body: fakeDeltaLocus}),
          },
          locusInfo: {
            handleLocusDelta: sandbox.stub(),
          },
          locusUrl: 'current locus url',
        };

        locusInfo.locusParser.workingCopy = {
          syncUrl: 'current sync url',
        };

        locusInfo.applyLocusDeltaData(LOCUS_URL_CHANGED, fakeLocus, meeting);
        assert.calledOnceWithExactly(meeting.meetingRequest.getLocusDTO, {url: 'current sync url'});
      });

      describe('edge cases for sync failing', () => {
        const {DESYNC} = LocusDeltaParser.loci;
        const fakeFullLocusDto = {id: 'fake full locus dto'};
        let meeting;

        beforeEach(() => {
          sinon.stub(locusInfo.locusParser, 'resume');
          sinon.stub(webex.meetings, 'destroy');

          meeting = {
            meetingRequest: {
              getLocusDTO: sandbox.stub(),
            },
            locusInfo: {
              handleLocusDelta: sandbox.stub(),
              onFullLocus: sandbox.stub(),
            },
            locusUrl: 'fullSyncUrl',
          };

          locusInfo.locusParser.workingCopy = {
            syncUrl: 'deltaSyncUrl',
          };
        });

        it('applyLocusDeltaData gets full locus on DESYNC action if we do not have a syncUrl and destroys the meeting if that fails', () => {
          meeting.meetingRequest.getLocusDTO.rejects(new Error('fake error'));

          locusInfo.locusParser.workingCopy = {}; // no syncUrl

          // Since we have a promise inside a function we want to test that's not returned,
          // we will wait and stub it's last function to resolve this waiting promise.
          return new Promise((resolve) => {
            webex.meetings.destroy.callsFake(() => resolve());
            locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
          }).then(() => {
            assert.calledOnceWithExactly(meeting.meetingRequest.getLocusDTO, {url: 'fullSyncUrl'});

            assert.notCalled(meeting.locusInfo.handleLocusDelta);
            assert.notCalled(meeting.locusInfo.onFullLocus);
            assert.notCalled(locusInfo.locusParser.resume);

            assert.calledOnceWithExactly(webex.meetings.destroy, meeting, 'LOCUS_DTO_SYNC_FAILED');
          });
        });

        it('applyLocusDeltaData first tries a delta sync on DESYNC action and if that fails, does a full locus sync', () => {
          meeting.meetingRequest.getLocusDTO.onCall(0).rejects(new Error('fake error'));
          meeting.meetingRequest.getLocusDTO.onCall(1).resolves({body: fakeFullLocusDto});

          // Since we have a promise inside a function we want to test that's not returned,
          // we will wait and stub it's last function to resolve this waiting promise.
          return new Promise((resolve) => {
            locusInfo.locusParser.resume.callsFake(() => resolve());
            locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
          }).then(() => {
            assert.calledTwice(meeting.meetingRequest.getLocusDTO);

            assert.deepEqual(meeting.meetingRequest.getLocusDTO.getCalls()[0].args, [
              {url: 'deltaSyncUrl'},
            ]);
            assert.deepEqual(meeting.meetingRequest.getLocusDTO.getCalls()[1].args, [
              {url: 'fullSyncUrl'},
            ]);

            assert.calledWith(sendBehavioralMetricStub, 'js_sdk_locus_delta_sync_failed', {
              correlationId: meeting.correlationId,
              url: 'deltaSyncUrl',
              reason: 'fake error',
              errorName: 'Error',
              stack: sinon.match.any,
              code: sinon.match.any,
            });

            assert.notCalled(meeting.locusInfo.handleLocusDelta);
            assert.calledOnceWithExactly(meeting.locusInfo.onFullLocus, fakeFullLocusDto);
            assert.calledOnce(locusInfo.locusParser.resume);
          });
        });

        it('applyLocusDeltaData destroys the meeting if both delta sync and full sync fail', () => {
          meeting.meetingRequest.getLocusDTO.rejects(new Error('fake error'));

          // Since we have a promise inside a function we want to test that's not returned,
          // we will wait and stub it's last function to resolve this waiting promise.
          return new Promise((resolve) => {
            webex.meetings.destroy.callsFake(() => resolve());
            locusInfo.applyLocusDeltaData(DESYNC, fakeLocus, meeting);
          }).then(() => {
            assert.calledTwice(meeting.meetingRequest.getLocusDTO);

            assert.deepEqual(meeting.meetingRequest.getLocusDTO.getCalls()[0].args, [
              {url: 'deltaSyncUrl'},
            ]);
            assert.deepEqual(meeting.meetingRequest.getLocusDTO.getCalls()[1].args, [
              {url: 'fullSyncUrl'},
            ]);

            assert.calledWith(sendBehavioralMetricStub, 'js_sdk_locus_delta_sync_failed', {
              correlationId: meeting.correlationId,
              url: 'deltaSyncUrl',
              reason: 'fake error',
              errorName: 'Error',
              stack: sinon.match.any,
              code: sinon.match.any,
            });

            assert.notCalled(meeting.locusInfo.handleLocusDelta);
            assert.notCalled(meeting.locusInfo.onFullLocus);
            assert.notCalled(locusInfo.locusParser.resume);

            assert.calledOnceWithExactly(webex.meetings.destroy, meeting, 'LOCUS_DTO_SYNC_FAILED');
          });
        });
      });

      it('onDeltaLocus handle delta data', () => {
        fakeLocus.participants = {};
        const fakeBreakout = {
          sessionId: 'sessionId',
          groupId: 'groupId',
        };

        fakeLocus.controls = {
          breakout: fakeBreakout,
        };
        locusInfo.controls = {
          breakout: {
            sessionId: 'sessionId',
            groupId: 'groupId',
          },
        };
        locusInfo.updateParticipants = sinon.stub();
        locusInfo.onDeltaLocus(fakeLocus);
        assert.calledWith(locusInfo.updateParticipants, {}, false);

        fakeLocus.controls.breakout.sessionId = 'sessionId2';
        locusInfo.onDeltaLocus(fakeLocus);
        assert.calledWith(locusInfo.updateParticipants, {}, true);
      });
    });

    describe('#updateLocusCache', () => {
      it('cache it if income locus is main session locus', () => {
        const locus = {url: 'url'};
        locusInfo.mainSessionLocusCache = null;
        locusInfo.updateLocusCache(locus);

        assert.deepEqual(locusInfo.mainSessionLocusCache, locus);
      });

      it('not cache it if income locus is breakout session locus', () => {
        const locus = {url: 'url', controls: {breakout: {sessionType: 'BREAKOUT'}}};
        locusInfo.mainSessionLocusCache = null;
        locusInfo.updateLocusCache(locus);

        assert.isNull(locusInfo.mainSessionLocusCache);
      });
    });

    describe('#getTheLocusToUpdate', () => {
      it('return the cache locus if return to main session and do not clear main session cache', () => {
        locusInfo.mainSessionLocusCache = {url: 'url'};
        locusInfo.controls = {
          breakout: {
            sessionType: 'BREAKOUT',
          },
        };
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'MAIN',
            },
          },
        };

        assert.deepEqual(locusInfo.getTheLocusToUpdate(newLocus), {url: 'url'});

        locusInfo.clearMainSessionLocusCache = sinon.stub();
        locusInfo.getTheLocusToUpdate(newLocus);
        assert.notCalled(locusInfo.clearMainSessionLocusCache);
      });

      it('return the new locus if return to main session but no cache and do not clear main session cache', () => {
        locusInfo.mainSessionLocusCache = null;
        locusInfo.controls = {
          breakout: {
            sessionType: 'BREAKOUT',
          },
        };
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'MAIN',
            },
          },
        };

        assert.deepEqual(locusInfo.getTheLocusToUpdate(newLocus), newLocus);

        locusInfo.clearMainSessionLocusCache = sinon.stub();
        locusInfo.getTheLocusToUpdate(newLocus);
        assert.notCalled(locusInfo.clearMainSessionLocusCache);
      });

      it('return the new locus if not return to main session and clear main session cache', () => {
        locusInfo.mainSessionLocusCache = {
          controls: {
            breakout: {
              sessionType: 'MAIN',
            },
          },
          self: {removed: true},
        };
        locusInfo.fullState = {state: 'ACTIVE'};
        locusInfo.controls = {
          breakout: {
            sessionType: 'MAIN',
          },
        };
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'BREAKOUT',
            },
          },
        };

        locusInfo.clearMainSessionLocusCache = sinon.stub();
        const result = locusInfo.getTheLocusToUpdate(newLocus);
        assert.calledOnce(locusInfo.clearMainSessionLocusCache);

        assert.deepEqual(result, newLocus);
      });

      it('do not clear main session cache when "mainSessionLocusCache?.self?.removed" is not true', () => {
        locusInfo.mainSessionLocusCache = {
          controls: {
            breakout: {
              sessionType: 'MAIN',
            },
          },
          self: {removed: undefined},
        };
        locusInfo.fullState = {state: 'ACTIVE'};
        locusInfo.controls = {
          breakout: {
            sessionType: 'MAIN',
          },
        };
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'BREAKOUT',
            },
          },
        };

        locusInfo.clearMainSessionLocusCache = sinon.stub();
        locusInfo.getTheLocusToUpdate(newLocus);
        assert.notCalled(locusInfo.clearMainSessionLocusCache);
      });
    });

    describe('#mergeParticipants', () => {
      let participants;
      let sourceParticipants;
      beforeEach(() => {
        participants = [{id: '111', status: 'JOINED'}, {id: '222'}];
        sourceParticipants = [{id: '111', status: 'LEFT'}, {id: '333'}];
      });

      it('merge the participants, replace it by id if exist in old array', () => {
        const result = locusInfo.mergeParticipants(participants, sourceParticipants);
        assert.deepEqual(result, [{id: '111', status: 'LEFT'}, {id: '222'}, {id: '333'}]);
      });

      it('return new participants if previous participants is empty', () => {
        const result = locusInfo.mergeParticipants([], sourceParticipants);
        assert.deepEqual(result, sourceParticipants);
      });

      it('return new participants if previous participants is null/undefined', () => {
        let result = locusInfo.mergeParticipants(null, sourceParticipants);
        assert.deepEqual(result, sourceParticipants);

        result = locusInfo.mergeParticipants(undefined, sourceParticipants);
        assert.deepEqual(result, sourceParticipants);
      });

      it('return previous participants if new participants is empty', () => {
        const result = locusInfo.mergeParticipants(participants, []);
        assert.deepEqual(result, participants);
      });

      it('return previous participants if new participants is null/undefined', () => {
        let result = locusInfo.mergeParticipants(participants, null);
        assert.deepEqual(result, participants);

        result = locusInfo.mergeParticipants(participants, undefined);
        assert.deepEqual(result, participants);
      });
    });

    describe('#updateMainSessionLocusCache', () => {
      let cachedLocus;
      let newLocus;
      beforeEach(() => {
        cachedLocus = {
          controls: {},
          participants: [],
          info: {webExMeetingId: 'testId1', topic: 'test'},
        };
        newLocus = {
          self: {},
          participants: [{id: '111'}],
          info: {testId: 'testId2', webExMeetingName: 'hello'},
        };
      });
      it('shallow merge new locus into cache', () => {
        locusInfo.mainSessionLocusCache = cachedLocus;
        locusInfo.updateMainSessionLocusCache(newLocus);

        assert.deepEqual(locusInfo.mainSessionLocusCache, {
          controls: {},
          participants: [{id: '111'}],
          info: {testId: 'testId2', webExMeetingName: 'hello'},
          self: {},
        });
      });

      it('cache new locus if no cache before', () => {
        locusInfo.mainSessionLocusCache = null;
        locusInfo.updateMainSessionLocusCache(newLocus);

        assert.deepEqual(locusInfo.mainSessionLocusCache, newLocus);
      });

      it('do nothing if new locus is null', () => {
        locusInfo.mainSessionLocusCache = cachedLocus;
        locusInfo.updateMainSessionLocusCache(null);

        assert.deepEqual(locusInfo.mainSessionLocusCache, cachedLocus);
      });
    });

    describe('#clearMainSessionLocusCache', () => {
      it('clear main session locus cache', () => {
        locusInfo.mainSessionLocusCache = {controls: {}};
        locusInfo.clearMainSessionLocusCache();
        assert.isNull(locusInfo.mainSessionLocusCache);
      });
    });

    describe('#handleOneonOneEvent', () => {
      beforeEach(() => {
        locusInfo.emitScoped = sinon.stub();
      });
      it('emits `REMOTE_RESPONSE`', () => {
        // 'locus.participant_joined'

        locusInfo.parsedLocus.fullState.type = 'SIP_BRIDGE';
        locusInfo.handleOneOnOneEvent('locus.participant_declined');

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent',
          },
          'REMOTE_RESPONSE',
          {
            remoteDeclined: true,
            remoteAnswered: false,
          }
        );

        locusInfo.parsedLocus.fullState.type = 'SIP_BRIDGE';
        locusInfo.handleOneOnOneEvent('locus.participant_joined');

        assert.calledWith(
          locusInfo.emitScoped,
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent',
          },
          'REMOTE_RESPONSE',
          {
            remoteDeclined: false,
            remoteAnswered: true,
          }
        );
      });
    });

    describe('#isMeetingActive', () => {
      it('sends client event correctly for state = inactive', () => {
        locusInfo.parsedLocus = {
          fullState: {
            type: _CALL_,
          },
        };

        locusInfo.fullState = {
          state: LOCUS.STATE.INACTIVE,
        };

        locusInfo.isMeetingActive();

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.remote-ended',
          options: {
            meetingId: locusInfo.meetingId,
          },
        });
      });

      it('sends client event correctly for state = PARTNER_LEFT', () => {
        locusInfo.getLocusPartner = sinon.stub().returns({state: MEETING_STATE.STATES.LEFT});
        locusInfo.parsedLocus = {
          fullState: {
            type: _CALL_,
          },
          self: {
            state: MEETING_STATE.STATES.DECLINED,
          },
        };
        locusInfo.isMeetingActive();

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.remote-ended',
          options: {
            meetingId: locusInfo.meetingId,
          },
        });
      });

      it('sends client event correctly for state = SELF_LEFT', () => {
        locusInfo.getLocusPartner = sinon.stub().returns({state: MEETING_STATE.STATES.LEFT});
        locusInfo.parsedLocus = {
          fullState: {
            type: _CALL_,
          },
          self: {
            state: MEETING_STATE.STATES.LEFT,
          },
        };

        locusInfo.isMeetingActive();

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.remote-ended',
          options: {
            meetingId: locusInfo.meetingId,
          },
        });
      });

      it('sends client event correctly for state = MEETING_INACTIVE_TERMINATING', () => {
        locusInfo.getLocusPartner = sinon.stub().returns({state: MEETING_STATE.STATES.LEFT});
        locusInfo.parsedLocus = {
          fullState: {
            type: _MEETING_,
          },
        };

        locusInfo.fullState = {
          state: LOCUS.STATE.INACTIVE,
        };

        locusInfo.isMeetingActive();

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.remote-ended',
          options: {
            meetingId: locusInfo.meetingId,
          },
        });
      });

      it('sends client event correctly for state = FULLSTATE_REMOVED', () => {
        locusInfo.getLocusPartner = sinon.stub().returns({state: MEETING_STATE.STATES.LEFT});
        locusInfo.parsedLocus = {
          fullState: {
            type: _MEETING_,
          },
        };

        locusInfo.fullState = {
          removed: true,
        };

        locusInfo.isMeetingActive();

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.remote-ended',
          options: {
            meetingId: locusInfo.meetingId,
          },
        });
      });
    });

    // semi-integration tests that use real LocusInfo with real Parser
    // and test various scenarios related to handling out-of-order Locus delta events
    describe('handling of out-of-order Locus delta events', () => {
      let clock;

      const generateDeltaEvent = (base, sequence) => {
        return {
          baseSequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [base],
          },
          sequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [sequence],
          },
          syncUrl: `fake sync url for sequence ${sequence}`,
          self: {
            person: {
              id: 'test person id',
            },
          },
        };
      };

      // a list of example delta events, sorted by time and each event is based on the previous one
      const deltaEvents = [
        generateDeltaEvent(10, 20), // 0
        generateDeltaEvent(20, 30), // 1
        generateDeltaEvent(30, 40), // 2
        generateDeltaEvent(40, 50), // 3
        generateDeltaEvent(50, 60), // 4
        generateDeltaEvent(60, 70), // 5
        generateDeltaEvent(70, 80), // 6
        generateDeltaEvent(80, 90), // 7
        generateDeltaEvent(90, 100), // 8
      ];

      let updateLocusInfoStub; // we use this stub to verify that an event has been fully processed
      let syncRequestStub;

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        sinon.stub(locusInfo, 'updateParticipantDeltas');
        sinon.stub(locusInfo, 'updateParticipants');
        sinon.stub(locusInfo, 'isMeetingActive'),
          sinon.stub(locusInfo, 'handleOneOnOneEvent'),
          (updateLocusInfoStub = sinon.stub(locusInfo, 'updateLocusInfo'));
        syncRequestStub = sinon.stub().resolves({body: {}});

        mockMeeting.locusInfo = locusInfo;
        mockMeeting.locusUrl = 'fake locus url';
        mockMeeting.meetingRequest = {
          getLocusDTO: syncRequestStub,
        };

        locusInfo.onFullLocus({
          sequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [10],
          },
          self: {
            person: {
              id: 'test person id',
            },
          },
        });

        updateLocusInfoStub.resetHistory();
      });

      afterEach(() => {
        clock.restore();
      });

      it('queues out-of-order deltas until it receives a correct delta', () => {
        // send some out-of-order deltas
        locusInfo.handleLocusDelta(deltaEvents[1], mockMeeting);
        locusInfo.handleLocusDelta(deltaEvents[4], mockMeeting);

        // they should be queued and not processed
        assert.notCalled(updateLocusInfoStub);

        // now one of the missing ones, but not the one SDK is really waiting for
        locusInfo.handleLocusDelta(deltaEvents[2], mockMeeting);

        // still nothing should be processed
        assert.notCalled(updateLocusInfoStub);

        // now send the one SDK is waiting for
        locusInfo.handleLocusDelta(deltaEvents[0], mockMeeting);

        // so deltaEvents with indexes 1,2,3 can be processed, but 5 still not, because 4 is missing
        assert.callCount(updateLocusInfoStub, 3);
        assert.calledWith(updateLocusInfoStub.getCall(0), deltaEvents[0]);
        assert.calledWith(updateLocusInfoStub.getCall(1), deltaEvents[1]);
        assert.calledWith(updateLocusInfoStub.getCall(2), deltaEvents[2]);

        updateLocusInfoStub.resetHistory();

        // now send deltaEvents[4]
        locusInfo.handleLocusDelta(deltaEvents[3], mockMeeting);

        // and verify deltaEvents[4] and deltaEvents[5] have been processed
        assert.callCount(updateLocusInfoStub, 2);
        assert.calledWith(updateLocusInfoStub.getCall(0), deltaEvents[3]);
        assert.calledWith(updateLocusInfoStub.getCall(1), deltaEvents[4]);
      });

      it('handles out-of-order deltas correctly even if all arrive in reverse order', () => {
        // send a bunch deltas in reverse order
        for (let i = 4; i >= 0; i--) {
          locusInfo.handleLocusDelta(deltaEvents[i], mockMeeting);
        }

        // they should be queued and then processed in correct order
        assert.callCount(updateLocusInfoStub, 5);
        assert.calledWith(updateLocusInfoStub.getCall(0), deltaEvents[0]);
        assert.calledWith(updateLocusInfoStub.getCall(1), deltaEvents[1]);
        assert.calledWith(updateLocusInfoStub.getCall(2), deltaEvents[2]);
        assert.calledWith(updateLocusInfoStub.getCall(3), deltaEvents[3]);
        assert.calledWith(updateLocusInfoStub.getCall(4), deltaEvents[4]);
      });

      it('sends a sync request using syncUrl if it receives at least 1 delta event and processes later deltas after sync correctly', async () => {
        // the test first sends an initial "good" delta
        const initialDeltaIdx = 0;
        const initialDelta = deltaEvents[initialDeltaIdx];

        // then it sends a bunch of out-of-order deltas (at least 6 to trigger a sync), last one being lastOooDelta
        const firstOooDeltaIdx = 2;
        const lastOooDeltaIdx = 7;
        const lastOooDelta = deltaEvents[lastOooDeltaIdx];

        // and finally, after the sync it sends another "good" delta
        const goodDeltaAfterSync = deltaEvents[8];

        const deltaLocusFromSyncResponse = {
          baseSequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [initialDelta.sequence.entries[0]],
          },
          sequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [lastOooDelta.sequence.entries[0]],
          },
          syncUrl: `fake sync url for sequence ${lastOooDelta.sequence.entries[0]}`,
          self: {
            person: {
              id: 'test person id',
            },
          },
        };

        syncRequestStub.resolves({
          body: deltaLocusFromSyncResponse,
        });

        // send one correct delta so that SDK has the syncUrl
        locusInfo.handleLocusDelta(initialDelta, mockMeeting);

        updateLocusInfoStub.resetHistory();

        // send 6 out-of-order deltas to trigger a sync (we're skipping deltaEvents[1])
        for (let i = firstOooDeltaIdx; i <= lastOooDeltaIdx; i++) {
          locusInfo.handleLocusDelta(deltaEvents[i], mockMeeting);
        }

        await testUtils.flushPromises();

        // check that sync was done using the correct syncUrl
        assert.calledOnceWithExactly(syncRequestStub, {url: initialDelta.syncUrl});
        assert.calledOnceWithExactly(updateLocusInfoStub, deltaLocusFromSyncResponse);

        updateLocusInfoStub.resetHistory();

        // now send another delta - a good one, it should be processed as normal
        locusInfo.handleLocusDelta(goodDeltaAfterSync, mockMeeting);

        assert.calledOnceWithExactly(updateLocusInfoStub, goodDeltaAfterSync);
      });

      it('does a sync if blocked on out-of-order deltas for too long', async () => {
        // stub random so that the timer fires after 12500 ms
        sinon.stub(Math, 'random').returns(0.5);

        const oooDelta = deltaEvents[3];

        // setup the stubs so that the sync request receives a full DTO with the sequence equal to the out-of-order delta we simulate
        const fullLocus = {
          sequence: oooDelta.sequence,
        };
        syncRequestStub.resolves({
          body: fullLocus,
        });

        // send an out-of-order delta
        locusInfo.handleLocusDelta(oooDelta, mockMeeting);

        assert.calledOnceWithExactly(sendBehavioralMetricStub, 'js_sdk_locus_delta_ooo', {
          stack: sinon.match.any,
        });

        await clock.tickAsync(12499);
        await testUtils.flushPromises();
        assert.notCalled(syncRequestStub);
        assert.notCalled(updateLocusInfoStub);

        await clock.tickAsync(1);
        await testUtils.flushPromises();

        assert.calledOnceWithExactly(syncRequestStub, {url: mockMeeting.locusUrl});
        assert.calledOnceWithExactly(updateLocusInfoStub, fullLocus);
      });

      it('does a sync if out-of-order deltas queue becomes too big', async () => {
        // setup the stubs so that the sync request receives a full DTO with the sequence equal to the out-of-order delta we simulate
        const fullLocus = {
          sequence: deltaEvents[6].sequence,
        };
        syncRequestStub.resolves({
          body: fullLocus,
        });

        // send 5 deltas, starting from deltaEvents[1] so that SDK is blocked waiting for deltaEvents[0]
        for (let i = 0; i < 5; i++) {
          locusInfo.handleLocusDelta(deltaEvents[i + 1], mockMeeting);
        }

        // nothing should happen, SDK should still be waiting for deltaEvents[0]
        assert.notCalled(syncRequestStub);
        assert.notCalled(updateLocusInfoStub);

        // now send one more out-of-order delta to trigger a sync request
        locusInfo.handleLocusDelta(deltaEvents[6], mockMeeting);

        await testUtils.flushPromises();

        // check sync was done
        assert.calledOnceWithExactly(syncRequestStub, {url: mockMeeting.locusUrl});
        assert.calledOnceWithExactly(updateLocusInfoStub, fullLocus);
      });

      it('processes delta events that are not included in sync response', async () => {
        // this test sends a bunch of out-of-order deltas, this triggers a sync
        // but the full locus response doesn't include the last 2 deltas received, so
        // we check that these 2 deltas are also processed after sync response
        const fullLocusFromSyncResponse = {
          baseSequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [deltaEvents[0].sequence.entries[0]],
          },
          sequence: {
            rangeStart: 0,
            rangeEnd: 0,
            entries: [deltaEvents[5].sequence.entries[0]],
          },
          syncUrl: `fake sync url for sequence ${deltaEvents[5].sequence.entries[0]}`,
          self: {
            person: {
              id: 'test person id',
            },
          },
        };

        syncRequestStub.resolves({
          body: fullLocusFromSyncResponse,
        });

        // send at least 6 out-of-order deltas to trigger a sync (we're skipping deltaEvents[0])
        for (let i = 1; i <= 7; i++) {
          locusInfo.handleLocusDelta(deltaEvents[i], mockMeeting);
        }

        await testUtils.flushPromises();

        // check that sync was done
        assert.calledOnceWithExactly(syncRequestStub, {url: mockMeeting.locusUrl});

        // and that remaining deltas from the queue that were not included in full Locus were also processed
        assert.callCount(updateLocusInfoStub, 3);
        assert.calledWith(updateLocusInfoStub.getCall(0), fullLocusFromSyncResponse);
        assert.calledWith(updateLocusInfoStub.getCall(1), deltaEvents[6]);
        assert.calledWith(updateLocusInfoStub.getCall(2), deltaEvents[7]);
      });
    });
  });
});
