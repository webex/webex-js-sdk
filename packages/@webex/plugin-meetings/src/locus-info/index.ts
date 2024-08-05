import {isEqual, assignWith, cloneDeep, isEmpty} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';
import EventsScope from '../common/events/events-scope';
import {
  EVENTS,
  LOCUSEVENT,
  _USER_,
  _CALL_,
  _SIP_BRIDGE_,
  MEETING_STATE,
  _MEETING_,
  LOCUSINFO,
  LOCUS,
  _LEFT_,
  MEETING_REMOVED_REASON,
  CALL_REMOVED_REASON,
  RECORDING_STATE,
} from '../constants';
import InfoUtils from './infoUtils';
import FullState from './fullState';
import SelfUtils from './selfUtils';
import HostUtils from './hostUtils';
import ControlsUtils from './controlsUtils';
import EmbeddedAppsUtils from './embeddedAppsUtils';
import MediaSharesUtils from './mediaSharesUtils';
import LocusDeltaParser from './parser';
import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';

/**
 * @description LocusInfo extends ChildEmitter to convert locusInfo info a private emitter to parent object
 * @export
 * @private
 * @class LocusInfo
 */
export default class LocusInfo extends EventsScope {
  compareAndUpdateFlags: any;
  emitChange: any;
  locusParser: any;
  meetingId: any;
  parsedLocus: any;
  updateMeeting: any;
  webex: any;
  aclUrl: any;
  baseSequence: any;
  created: any;
  deltaParticipants: any;
  identities: any;
  membership: any;
  participants: any;
  participantsUrl: any;
  replaces: any;
  scheduledMeeting: any;
  sequence: any;
  controls: any;
  conversationUrl: any;
  embeddedApps: any;
  fullState: any;
  host: any;
  info: any;
  roles: any;
  mediaShares: any;
  replace: any;
  url: any;
  services: any;
  mainSessionLocusCache: any;
  /**
   * Constructor
   * @param {function} updateMeeting callback to update the meeting object from an object
   * @param {object} webex
   * @param {string} meetingId
   * @returns {undefined}
   */
  constructor(updateMeeting, webex, meetingId) {
    super();
    this.parsedLocus = {
      states: [],
    };
    this.webex = webex;
    this.emitChange = false;
    this.compareAndUpdateFlags = {};
    this.meetingId = meetingId;
    this.updateMeeting = updateMeeting;
    this.locusParser = new LocusDeltaParser();
  }

  /**
   * Does a Locus sync. It tries to get the latest delta DTO or if it can't, it falls back to getting the full Locus DTO.
   *
   * @param {Meeting} meeting
   * @returns {undefined}
   */
  private doLocusSync(meeting: any) {
    let isDelta;
    let url;

    if (this.locusParser.workingCopy.syncUrl) {
      url = this.locusParser.workingCopy.syncUrl;
      isDelta = true;
    } else {
      url = meeting.locusUrl;
      isDelta = false;
    }

    LoggerProxy.logger.info(
      `Locus-info:index#doLocusSync --> doing Locus sync (getting ${
        isDelta ? 'delta' : 'full'
      } DTO)`
    );

    // return value ignored on purpose
    meeting.meetingRequest
      .getLocusDTO({url})
      .catch((e) => {
        if (isDelta) {
          LoggerProxy.logger.info(
            'Locus-info:index#doLocusSync --> delta sync failed, falling back to full sync'
          );

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.LOCUS_DELTA_SYNC_FAILED, {
            correlationId: meeting.correlationId,
            url,
            reason: e.message,
            errorName: e.name,
            stack: e.stack,
            code: e.code,
          });

          isDelta = false;

          return meeting.meetingRequest.getLocusDTO({url: meeting.locusUrl}).catch((err) => {
            LoggerProxy.logger.info(
              'Locus-info:index#doLocusSync --> fallback full sync failed, destroying the meeting'
            );
            this.webex.meetings.destroy(meeting, MEETING_REMOVED_REASON.LOCUS_DTO_SYNC_FAILED);
            throw err;
          });
        }
        LoggerProxy.logger.info(
          'Locus-info:index#doLocusSync --> fallback full sync failed, destroying the meeting'
        );
        this.webex.meetings.destroy(meeting, MEETING_REMOVED_REASON.LOCUS_DTO_SYNC_FAILED);
        throw e;
      })
      .then((res) => {
        if (isDelta) {
          if (!isEmpty(res.body)) {
            meeting.locusInfo.handleLocusDelta(res.body, meeting);
          } else {
            LoggerProxy.logger.info(
              'Locus-info:index#doLocusSync --> received empty body from syncUrl, so we already have latest Locus DTO'
            );
          }
        } else {
          meeting.locusInfo.onFullLocus(res.body);
        }
        // Notify parser to resume processing delta events.
        // Any deltas in the queue that have now been superseded by this sync will simply be ignored
        this.locusParser.resume();
      });
  }

  /**
   * Apply locus delta data to meeting
   * @param {string} action Locus delta action
   * @param {Locus} locus
   * @param {Meeting} meeting
   * @returns {undefined}
   */
  applyLocusDeltaData(action: string, locus: any, meeting: any) {
    const {DESYNC, USE_CURRENT, USE_INCOMING, WAIT, LOCUS_URL_CHANGED} = LocusDeltaParser.loci;

    switch (action) {
      case USE_INCOMING:
        meeting.locusInfo.onDeltaLocus(locus);
        break;
      case USE_CURRENT:
      case WAIT:
        // do nothing
        break;
      case DESYNC:
      case LOCUS_URL_CHANGED:
        this.doLocusSync(meeting);
        break;
      default:
        LoggerProxy.logger.info(
          `Locus-info:index#applyLocusDeltaData --> Unknown locus delta action: ${action}`
        );
    }
  }

  /**
   * Adds locus delta to parser's queue
   * and registers a function handler
   * to recieve parsed actions from queue.
   * @param {Locus} locus
   * @param {Meeting} meeting
   * @returns {undefined}
   */
  handleLocusDelta(locus: any, meeting: any) {
    // register a function to process delta actions
    if (!this.locusParser.onDeltaAction) {
      // delta action, along with associated loci
      // is passed into the function.
      this.locusParser.onDeltaAction = (action, parsedLoci) => {
        this.applyLocusDeltaData(action, parsedLoci, meeting);
      };
    }
    // queue delta event with parser
    this.locusParser.onDeltaEvent(locus);
  }

  /**
   * @param {Locus} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  init(locus: any = {}) {
    this.created = locus.created || null;
    this.scheduledMeeting = locus.meeting || null;
    this.participantsUrl = locus.participantsUrl || null;
    this.replaces = locus.replaces || null;
    this.aclUrl = locus.aclUrl || null;
    this.baseSequence = locus.baseSequence || null;
    this.sequence = locus.sequence || null;
    this.membership = locus.membership || null;
    this.identities = locus.identities || null;
    this.participants = locus.participants || null;

    /**
     * Stores the delta values for a changed participant.
     *
     * @typedef {Object} DeltaParticipant
     * @property {Record<string, boolean>} delta - Contains changed streams.
     * @property {Object} person - Contains person data.
     */

    /**
     * Stored participant changes between the last event and the current event.
     * All previously stored events are overwritten between events.
     *
     * @instance
     * @type {Array<DeltaParticipant>}
     * @private
     * @member LocusInfo
     */
    this.deltaParticipants = [];

    this.updateLocusCache(locus);
    // above section only updates the locusInfo object
    // The below section makes sure it updates the locusInfo as well as updates the meeting object
    this.updateParticipants(locus.participants);
    // For 1:1 space meeting the conversation Url does not exist in locus.conversation
    this.updateConversationUrl(locus.conversationUrl, locus.info);
    this.updateControls(locus.controls, locus.self);
    this.updateLocusUrl(locus.url);
    this.updateFullState(locus.fullState);
    this.updateMeetingInfo(locus.info);
    this.updateEmbeddedApps(locus.embeddedApps);
    // self and participants generate sipUrl for 1:1 meeting
    this.updateSelf(locus.self, locus.participants);
    this.updateHostInfo(locus.host);
    this.updateMediaShares(locus.mediaShares);
    this.updateServices(locus.links?.services);
  }

  /**
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  initialSetup(locus: object) {
    this.updateLocusCache(locus);
    this.onFullLocus(locus);

    // Change it to true after it receives it first locus object
    this.emitChange = true;
  }

  /**
   * @param {Meeting} meeting
   * @param {Object} data
   * @returns {undefined}
   * @memberof LocusInfo
   */
  parse(meeting: any, data: any) {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const {eventType} = data;
    const locus = this.getTheLocusToUpdate(data.locus);
    LoggerProxy.logger.info(`Locus-info:index#parse --> received locus data: ${eventType}`);

    switch (eventType) {
      case LOCUSEVENT.PARTICIPANT_JOIN:
      case LOCUSEVENT.PARTICIPANT_LEFT:
      case LOCUSEVENT.CONTROLS_UPDATED:
      case LOCUSEVENT.PARTICIPANT_AUDIO_MUTED:
      case LOCUSEVENT.PARTICIPANT_AUDIO_UNMUTED:
      case LOCUSEVENT.PARTICIPANT_VIDEO_MUTED:
      case LOCUSEVENT.PARTICIPANT_VIDEO_UNMUTED:
      case LOCUSEVENT.SELF_CHANGED:
      case LOCUSEVENT.PARTICIPANT_UPDATED:
      case LOCUSEVENT.PARTICIPANT_CONTROLS_UPDATED:
      case LOCUSEVENT.PARTICIPANT_ROLES_UPDATED:
      case LOCUSEVENT.PARTICIPANT_DECLINED:
      case LOCUSEVENT.FLOOR_GRANTED:
      case LOCUSEVENT.FLOOR_RELEASED:
        this.onFullLocus(locus, eventType);
        break;
      case LOCUSEVENT.DIFFERENCE:
        this.handleLocusDelta(locus, meeting);
        break;

      default:
        // Why will there be a event with no eventType ????
        // we may not need this, we can get full locus
        this.handleLocusDelta(locus, meeting);
    }
  }

  /**
   * @param {String} scope
   * @param {String} eventName
   * @param {Array} args
   * @returns {undefined}
   * @memberof LocusInfo
   */
  emitScoped(scope?: any, eventName?: string, args?: any) {
    return this.emit(scope, eventName, args);
  }

  /**
   * updates the locus with full locus object
   * @param {object} locus locus object
   * @param {string} eventType particulat locus event
   * @returns {object} null
   * @memberof LocusInfo
   */
  onFullLocus(locus: any, eventType?: string) {
    if (!locus) {
      LoggerProxy.logger.error(
        'Locus-info:index#onFullLocus --> object passed as argument was invalid, continuing.'
      );
    }

    if (!this.locusParser.isNewFullLocus(locus)) {
      LoggerProxy.logger.info(
        `Locus-info:index#onFullLocus --> ignoring old full locus DTO, eventType=${eventType}`
      );

      return;
    }

    this.updateParticipantDeltas(locus.participants);
    this.scheduledMeeting = locus.meeting || null;
    this.participants = locus.participants;
    const isReplaceMembers = ControlsUtils.isNeedReplaceMembers(this.controls, locus.controls);
    this.updateLocusInfo(locus);
    this.updateParticipants(locus.participants, isReplaceMembers);
    this.isMeetingActive();
    this.handleOneOnOneEvent(eventType);
    this.updateEmbeddedApps(locus.embeddedApps);
    // set current (working copy) for parser
    this.locusParser.workingCopy = locus;
  }

  // used for ringing stops on one on one
  /**
   * @param {String} eventType
   * @returns {undefined}
   * @memberof LocusInfo
   */
  // eslint-disable-next-line @typescript-eslint/no-shadow
  handleOneOnOneEvent(eventType: string) {
    if (
      this.parsedLocus.fullState.type === _CALL_ ||
      this.parsedLocus.fullState.type === _SIP_BRIDGE_
    ) {
      // for 1:1 bob calls alice and alice declines, notify the meeting state
      if (eventType === LOCUSEVENT.PARTICIPANT_DECLINED) {
        // trigger the event for stop ringing
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent',
          },
          EVENTS.REMOTE_RESPONSE,
          {
            remoteDeclined: true,
            remoteAnswered: false,
          }
        );
      }
      // for 1:1 bob calls alice and alice answers, notify the meeting state
      if (eventType === LOCUSEVENT.PARTICIPANT_JOIN) {
        // trigger the event for stop ringing
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent',
          },
          EVENTS.REMOTE_RESPONSE,
          {
            remoteDeclined: false,
            remoteAnswered: true,
          }
        );
      }
    }
  }

  /**
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  onDeltaLocus(locus: any) {
    const isReplaceMembers = ControlsUtils.isNeedReplaceMembers(this.controls, locus.controls);
    this.updateLocusInfo(locus);
    this.updateParticipants(locus.participants, isReplaceMembers);
    this.isMeetingActive();
  }

  /**
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateLocusInfo(locus) {
    if (locus.self?.reason === 'MOVED' && locus.self?.state === 'LEFT') {
      // When moved to a breakout session locus sends a message for the previous locus
      // indicating that we have been moved. It isn't helpful to continue parsing this
      // as it gets interpreted as if we have left the call
      return;
    }

    this.updateControls(locus.controls, locus.self);
    this.updateConversationUrl(locus.conversationUrl, locus.info);
    this.updateCreated(locus.created);
    this.updateFullState(locus.fullState);
    this.updateHostInfo(locus.host);
    this.updateMeetingInfo(locus.info, locus.self);
    this.updateMediaShares(locus.mediaShares);
    this.updateParticipantsUrl(locus.participantsUrl);
    this.updateReplace(locus.replace);
    this.updateSelf(locus.self, locus.participants);
    this.updateLocusUrl(locus.url);
    this.updateAclUrl(locus.aclUrl);
    this.updateBasequence(locus.baseSequence);
    this.updateSequence(locus.sequence);
    this.updateMemberShip(locus.membership);
    this.updateIdentifiers(locus.identities);
    this.updateEmbeddedApps(locus.embeddedApps);
    this.updateServices(locus.links?.services);
    this.compareAndUpdate();
    // update which required to compare different objects from locus
  }

  /**
   * @param {Array} participants
   * @param {Object} self
   * @returns {Array}
   * @memberof LocusInfo
   */
  getLocusPartner(participants: Array<any>, self: any) {
    if (!participants || participants.length === 0) {
      return null;
    }

    return (
      participants.find(
        (participant) =>
          self &&
          participant.identity !== self.identity &&
          (participants.length <= 2 || (participant.type === _USER_ && !participant.removed))
        // @ts-ignore
      ) || this.partner
    );
  }

  // TODO: all the leave states need to be checked
  /**
   * @returns {undefined}
   * @memberof LocusInfo
   */
  isMeetingActive() {
    if (
      this.parsedLocus.fullState.type === _CALL_ ||
      this.parsedLocus.fullState.type === _SIP_BRIDGE_
    ) {
      // @ts-ignore
      const partner = this.getLocusPartner(this.participants, this.self);

      this.updateMeeting({partner});

      // Check if guest user needs to be checked here

      // 1) when bob declines call from bob, (bob='DECLINED')
      // 2) When alice rejects call to bob , (bob='NOTIFIED')

      // When we dont add MEDIA for condition 2. The state of bob='IDLE'

      if (this.fullState && this.fullState.state === LOCUS.STATE.INACTIVE) {
        // console.log('marcin: isMeetingActive: 1st case CALL_INACTIVE');
        // TODO: update the meeting state
        LoggerProxy.logger.warn(
          'Locus-info:index#isMeetingActive --> Call Ended, locus state is inactive.'
        );

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.remote-ended',
          options: {
            meetingId: this.meetingId,
          },
        });

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.CALL_INACTIVE,
            shouldLeave: false,
          }
        );
      } else if (
        partner.state === MEETING_STATE.STATES.LEFT &&
        this.parsedLocus.self &&
        (this.parsedLocus.self.state === MEETING_STATE.STATES.DECLINED ||
          this.parsedLocus.self.state === MEETING_STATE.STATES.NOTIFIED ||
          this.parsedLocus.self.state === MEETING_STATE.STATES.JOINED)
      ) {
        // console.log('marcin: isMeetingActive: 2nd case PARTNER_LEFT');
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.remote-ended',
          options: {
            meetingId: this.meetingId,
          },
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.PARTNER_LEFT,
            shouldLeave:
              this.parsedLocus.self.joinedWith && this.parsedLocus.self.joinedWith.state !== _LEFT_,
          }
        );
      } else if (
        this.parsedLocus.self &&
        this.parsedLocus.self.state === MEETING_STATE.STATES.LEFT &&
        (partner.state === MEETING_STATE.STATES.LEFT ||
          partner.state === MEETING_STATE.STATES.DECLINED ||
          partner.state === MEETING_STATE.STATES.NOTIFIED ||
          partner.state === MEETING_STATE.STATES.IDLE) // Happens when user just joins and adds no Media
      ) {
        // console.log('marcin: isMeetingActive: last case SELF_LEFT');
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.remote-ended',
          options: {
            meetingId: this.meetingId,
          },
        });

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.SELF_LEFT,
            shouldLeave: false,
          }
        );
      }
    } else if (this.parsedLocus.fullState.type === _MEETING_) {
      if (
        this.fullState &&
        (this.fullState.state === LOCUS.STATE.INACTIVE ||
          // @ts-ignore
          this.fullState.state === LOCUS.STATE.TERMINATING)
      ) {
        LoggerProxy.logger.warn(
          'Locus-info:index#isMeetingActive --> Meeting is ending due to inactive or terminating'
        );

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.remote-ended',
          options: {
            meetingId: this.meetingId,
          },
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.MEETING_INACTIVE_TERMINATING,
            shouldLeave: false,
          }
        );
      } else if (this.fullState && this.fullState.removed) {
        // user has been dropped from a meeting

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.remote-ended',
          options: {
            meetingId: this.meetingId,
          },
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.FULLSTATE_REMOVED,
            shouldLeave: false,
          }
        );
      }
      // If you are  guest and you are removed from the meeting
      // You wont get any further events
      else if (this.parsedLocus.self && this.parsedLocus.self.removed) {
        // Check if we need to send an event
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.SELF_REMOVED,
            shouldLeave: false,
          }
        );
      }
    } else {
      LoggerProxy.logger.warn('Locus-info:index#isMeetingActive --> Meeting Type is unknown.');
    }
  }

  /**
   * checks if the host permissions have changed while in the meeting
   * This would be the case if your role as host or moderator has been updated
   * @returns {undefined}
   * @memberof LocusInfo
   */
  compareAndUpdate() {
    // TODO: check with locus team on host and moderator doc
    // use host as a validator if needed
    if (
      this.compareAndUpdateFlags.compareSelfAndHost ||
      this.compareAndUpdateFlags.compareHostAndSelf
    ) {
      this.compareSelfAndHost();
    }
  }

  /**
   * compared the self object to check if the user has host permissions
   * @returns {undefined}
   * @memberof LocusInfo
   */
  compareSelfAndHost() {
    // In some cases the host info is not present but the moderator values changes from null to false so it triggers an update
    if (
      this.parsedLocus.self.selfIdentity === this.parsedLocus.host?.hostId &&
      this.parsedLocus.self.moderator
    ) {
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'compareSelfAndHost',
        },
        EVENTS.LOCUS_INFO_CAN_ASSIGN_HOST,
        {
          canAssignHost: true,
        }
      );
    } else {
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'compareSelfAndHost',
        },
        EVENTS.LOCUS_INFO_CAN_ASSIGN_HOST,
        {
          canAssignHost: false,
        }
      );
    }
  }

  /**
   * Update the deltaParticipants property of this object based on a list of
   * provided participants.
   *
   * @param {Array} [participants] - The participants to update against.
   * @returns {void}
   */
  updateParticipantDeltas(participants: Array<any> = []) {
    // Used to find a participant within a participants collection.
    const findParticipant = (participant, collection) =>
      collection.find((item) => item.person.id === participant.person.id);

    // Generates an object that indicates which state properties have changed.
    const generateDelta = (prevState: any = {}, newState: any = {}) => {
      // Setup deltas.
      const deltas = {
        audioStatus: prevState.audioStatus !== newState.audioStatus,
        videoSlidesStatus: prevState.videoSlidesStatus !== newState.videoSlidesStatus,
        videoStatus: prevState.videoStatus !== newState.videoStatus,
      };

      // Clean the object
      Object.keys(deltas).forEach((key) => {
        if (deltas[key] !== true) {
          delete deltas[key];
        }
      });

      return deltas;
    };

    this.deltaParticipants = participants.reduce((collection, participant) => {
      const existingParticipant = findParticipant(participant, this.participants || []) || {};

      const delta = generateDelta(existingParticipant.status, participant.status);

      const changed = Object.keys(delta).length > 0;

      if (changed) {
        collection.push({
          person: participant.person,
          delta,
        });
      }

      return collection;
    }, []);
  }

  /**
   * update meeting's members
   * @param {Object} participants new participants object
   * @param {Boolean} isReplace is replace the whole members
   * @returns {Array} updatedParticipants
   * @memberof LocusInfo
   */
  updateParticipants(participants: object, isReplace?: boolean) {
    this.emitScoped(
      {
        file: 'locus-info',
        function: 'updateParticipants',
      },
      EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS,
      {
        participants,
        recordingId: this.parsedLocus.controls && this.parsedLocus.controls.record?.modifiedBy,
        selfIdentity: this.parsedLocus.self && this.parsedLocus.self.selfIdentity,
        selfId: this.parsedLocus.self && this.parsedLocus.self.selfId,
        hostId: this.parsedLocus.host && this.parsedLocus.host.hostId,
        isReplace,
      }
    );
  }

  /**
   * @param {Object} controls
   * @param {Object} self
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateControls(controls: object, self: object) {
    if (controls && !isEqual(this.controls, controls)) {
      this.parsedLocus.controls = ControlsUtils.parse(controls);
      const {
        updates: {
          hasRecordingChanged,
          hasRecordingPausedChanged,
          hasMeetingContainerChanged,
          hasTranscribeChanged,
          hasManualCaptionChanged,
          hasEntryExitToneChanged,
          hasBreakoutChanged,
          hasVideoEnabledChanged,
          hasMuteOnEntryChanged,
          hasShareControlChanged,
          hasDisallowUnmuteChanged,
          hasReactionsChanged,
          hasReactionDisplayNamesChanged,
          hasViewTheParticipantListChanged,
          hasRaiseHandChanged,
          hasVideoChanged,
          hasInterpretationChanged,
        },
        current,
      } = ControlsUtils.getControls(this.controls, controls);

      if (hasMuteOnEntryChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_MUTE_ON_ENTRY_CHANGED,
          {state: current.muteOnEntry}
        );
      }

      if (hasShareControlChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_SHARE_CONTROL_CHANGED,
          {state: current.shareControl}
        );
      }

      if (hasDisallowUnmuteChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_DISALLOW_UNMUTE_CHANGED,
          {state: current.disallowUnmute}
        );
      }

      if (hasReactionsChanged || hasReactionDisplayNamesChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_REACTIONS_CHANGED,
          {state: current.reactions}
        );
      }

      if (hasViewTheParticipantListChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_VIEW_THE_PARTICIPANTS_LIST_CHANGED,
          {state: current.viewTheParticipantList}
        );
      }

      if (hasRaiseHandChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_RAISE_HAND_CHANGED,
          {state: current.raiseHand}
        );
      }

      if (hasVideoChanged) {
        this.emitScoped(
          {file: 'locus-info', function: 'updateControls'},
          LOCUSINFO.EVENTS.CONTROLS_VIDEO_CHANGED,
          {state: current.video}
        );
      }

      if (hasRecordingChanged || hasRecordingPausedChanged) {
        let state = null;

        if (hasRecordingPausedChanged) {
          if (current.record.paused) {
            state = RECORDING_STATE.PAUSED;
          } else {
            // state will be `IDLE` if the recording is not active, even when there is a `pause` status change.
            state = current.record.recording ? RECORDING_STATE.RESUMED : RECORDING_STATE.IDLE;
          }
        } else if (hasRecordingChanged) {
          state = current.record.recording ? RECORDING_STATE.RECORDING : RECORDING_STATE.IDLE;
        }

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state,
            modifiedBy: current.record.modifiedBy,
            lastModified: current.record.lastModified,
          }
        );
      }

      if (hasMeetingContainerChanged) {
        const {meetingContainerUrl} = current.meetingContainer;

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
          {
            meetingContainerUrl,
          }
        );
      }

      if (hasTranscribeChanged) {
        const {transcribing, caption} = current.transcribe;

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_TRANSCRIBE_UPDATED,
          {
            transcribing,
            caption,
          }
        );
      }

      if (hasManualCaptionChanged) {
        const {enabled} = current.manualCaptionControl;

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_MANUAL_CAPTION_UPDATED,
          {
            enabled,
          }
        );
      }

      if (hasBreakoutChanged) {
        const {breakout} = current;
        breakout.breakoutMoveId = SelfUtils.getReplacedBreakoutMoveId(
          self,
          this.webex.internal.device.url
        );
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_BREAKOUT_UPDATED,
          {
            breakout,
          }
        );
      }

      if (hasInterpretationChanged) {
        const {interpretation} = current;
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_INTERPRETATION_UPDATED,
          {
            interpretation,
          }
        );
      }

      if (hasEntryExitToneChanged) {
        const {entryExitTone} = current;

        this.updateMeeting({entryExitTone});

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.CONTROLS_ENTRY_EXIT_TONE_UPDATED,
          {
            entryExitTone,
          }
        );
      }

      // videoEnabled is handled differently than other controls,
      // to fit with audio mute status logic
      if (hasVideoEnabledChanged) {
        const {videoEnabled} = current;

        this.updateMeeting({unmuteVideoAllowed: videoEnabled});

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
          {
            // muted: not part of locus.controls
            unmuteAllowed: videoEnabled,
          }
        );
      }

      this.controls = controls;
    }
  }

  /**
   * @param {String} conversationUrl
   * @param {Object} info
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateConversationUrl(conversationUrl: string, info: any) {
    if (conversationUrl && !isEqual(this.conversationUrl, conversationUrl)) {
      this.conversationUrl = conversationUrl;
      this.updateMeeting({conversationUrl});
    } else if (
      info &&
      info.conversationUrl &&
      !isEqual(this.conversationUrl, info.conversationUrl)
    ) {
      this.conversationUrl = info.conversationUrl;
      this.updateMeeting({conversationUrl: info.conversationUrl});
    }
  }

  /**
   * @param {Object} created
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateCreated(created: object) {
    if (created && !isEqual(this.created, created)) {
      this.created = created;
    }
  }

  /**
   * @param {Object} services
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateServices(services: Record<'breakout' | 'record', {url: string}>) {
    if (services && !isEqual(this.services, services)) {
      this.services = services;
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateServices',
        },
        LOCUSINFO.EVENTS.LINKS_SERVICES,
        {
          services,
        }
      );
    }
  }

  /**
   * @param {Object} fullState
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateFullState(fullState: object) {
    if (fullState && !isEqual(this.fullState, fullState)) {
      const result = FullState.getFullState(this.fullState, fullState);

      this.updateMeeting(result.current);

      if (result.updates.meetingStateChangedTo) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateFullState',
          },
          LOCUSINFO.EVENTS.FULL_STATE_MEETING_STATE_CHANGE,
          {
            previousState: result.previous && result.previous.meetingState,
            currentState: result.current.meetingState,
          }
        );
      }

      if (result.updates.meetingTypeChangedTo) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateFullState',
          },
          LOCUSINFO.EVENTS.FULL_STATE_TYPE_UPDATE,
          {
            type: result.current.type,
          }
        );
      }
      this.parsedLocus.fullState = result.current;
      this.fullState = fullState;
    }
  }

  /**
   * handles when the locus.host is updated
   * @param {Object} host the locus.host property
   * @returns {undefined}
   * @memberof LocusInfo
   * emits internal event locus_info_update_host
   */
  updateHostInfo(host: object) {
    if (host && !isEqual(this.host, host)) {
      const parsedHosts = HostUtils.getHosts(this.host, host);

      this.updateMeeting(parsedHosts.current);
      this.parsedLocus.host = parsedHosts.current;
      if (parsedHosts.updates.isNewHost) {
        this.compareAndUpdateFlags.compareSelfAndHost = true;
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateHostInfo',
          },
          EVENTS.LOCUS_INFO_UPDATE_HOST,
          {
            newHost: parsedHosts.current,
            oldHost: parsedHosts.previous,
          }
        );
      }
      this.host = host;
    } else {
      this.compareAndUpdateFlags.compareSelfAndHost = false;
    }
  }

  /**
   * @param {Object} info
   * @param {Object} self
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateMeetingInfo(info: object, self?: object) {
    const roles = self ? SelfUtils.getRoles(self) : this.parsedLocus.self?.roles || [];
    if (
      (info && !isEqual(this.info, info)) ||
      (roles.length && !isEqual(this.roles, roles) && info)
    ) {
      const isJoined = SelfUtils.isJoined(self || this.parsedLocus.self);
      const parsedInfo = InfoUtils.getInfos(this.parsedLocus.info, info, roles, isJoined);

      if (parsedInfo.updates.isLocked) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_LOCKED,
          info
        );
      }
      if (parsedInfo.updates.isUnlocked) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateMeetingInfo',
          },
          LOCUSINFO.EVENTS.MEETING_UNLOCKED,
          info
        );
      }

      this.info = info;
      this.parsedLocus.info = parsedInfo.current;
      // Parses the info and adds necessary values
      this.updateMeeting(parsedInfo.current);

      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateMeetingInfo',
        },
        LOCUSINFO.EVENTS.MEETING_INFO_UPDATED,
        {
          isInitializing: !self, // if self is undefined, then the update is caused by locus init
        }
      );
    }
    this.roles = roles;
  }

  /**
   * @param {Object} embeddedApps
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateEmbeddedApps(embeddedApps: object) {
    // don't do anything if the arrays of apps haven't changed significantly
    if (EmbeddedAppsUtils.areSimilar(this.embeddedApps, embeddedApps)) {
      return;
    }

    const parsedEmbeddedApps = EmbeddedAppsUtils.parse(embeddedApps);

    this.updateMeeting({embeddedApps: parsedEmbeddedApps});

    this.emitScoped(
      {
        file: 'locus-info',
        function: 'updateEmbeddedApps',
      },
      LOCUSINFO.EVENTS.EMBEDDED_APPS_UPDATED,
      parsedEmbeddedApps
    );
    this.embeddedApps = embeddedApps;
  }

  /**
   * handles when the locus.mediaShares is updated
   * @param {Object} mediaShares the locus.mediaShares property
   * @returns {undefined}
   * @memberof LocusInfo
   * emits internal event locus_info_update_media_shares
   */
  updateMediaShares(mediaShares: object) {
    if (mediaShares && !isEqual(this.mediaShares, mediaShares)) {
      const parsedMediaShares = MediaSharesUtils.getMediaShares(this.mediaShares, mediaShares);

      this.updateMeeting(parsedMediaShares.current);
      this.parsedLocus.mediaShares = parsedMediaShares.current;
      this.mediaShares = mediaShares;
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateMediaShares',
        },
        EVENTS.LOCUS_INFO_UPDATE_MEDIA_SHARES,
        {
          current: parsedMediaShares.current,
          previous: parsedMediaShares.previous,
        }
      );
    }
  }

  /**
   * @param {String} participantsUrl
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateParticipantsUrl(participantsUrl: string) {
    if (participantsUrl && !isEqual(this.participantsUrl, participantsUrl)) {
      this.participantsUrl = participantsUrl;
    }
  }

  /**
   * @param {Object} replace
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateReplace(replace: object) {
    if (replace && !isEqual(this.replace, replace)) {
      this.replace = replace;
    }
  }

  /**
   * handles when the locus.self is updated
   * @param {Object} self the locus.mediaShares property
   * @param {Array} participants the locus.participants property
   * @returns {undefined}
   * @memberof LocusInfo
   * emits internal events self_admitted_guest, self_unadmitted_guest, locus_info_update_self
   */
  updateSelf(self: any, participants: Array<any>) {
    // @ts-ignore - check where this.self come from
    if (self && !isEqual(this.self, self)) {
      // @ts-ignore
      const parsedSelves = SelfUtils.getSelves(this.self, self, this.webex.internal.device.url);

      this.updateMeeting(parsedSelves.current);
      this.parsedLocus.self = parsedSelves.current;

      const element = this.parsedLocus.states[this.parsedLocus.states.length - 1];

      if (element !== parsedSelves.current.state) {
        this.parsedLocus.states.push(parsedSelves.current.state);
      }

      // TODO: check if we need to save the sipUri here as well
      // this.emit(LOCUSINFO.EVENTS.MEETING_UPDATE, SelfUtils.getSipUrl(this.getLocusPartner(participants, self), this.parsedLocus.fullState.type, this.parsedLocus.info.sipUri));
      const result = SelfUtils.getSipUrl(
        this.getLocusPartner(participants, self),
        this.parsedLocus.fullState.type,
        this.parsedLocus.info.sipUri
      );

      if (result.sipUri) {
        this.updateMeeting(result);
      }

      if (parsedSelves.updates.moderatorChanged) {
        this.compareAndUpdateFlags.compareHostAndSelf = true;
      } else {
        this.compareAndUpdateFlags.compareHostAndSelf = false;
      }

      if (parsedSelves.updates.layoutChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED,
          {layout: parsedSelves.current.layout}
        );
      }

      if (parsedSelves.updates.breakoutsChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MEETING_BREAKOUTS_CHANGED,
          {breakoutSessions: parsedSelves.current.breakoutSessions}
        );
      }

      if (parsedSelves.updates.interpretationChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MEETING_INTERPRETATION_CHANGED,
          {
            interpretation: parsedSelves.current.interpretation,
            selfParticipantId: parsedSelves.current.selfId,
          }
        );
      }

      if (parsedSelves.updates.isMediaInactiveOrReleased) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.DISCONNECT_DUE_TO_INACTIVITY,
          {reason: self.reason}
        );
      }

      if (parsedSelves.updates.moderatorChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_MODERATOR_CHANGED,
          self
        );
      }

      if (parsedSelves.updates.isRolesChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_ROLES_CHANGED,
          {oldRoles: parsedSelves.previous?.roles, newRoles: parsedSelves.current?.roles}
        );
      }

      if (parsedSelves.updates.isVideoMutedByOthersChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
          {
            muted: parsedSelves.current.remoteVideoMuted,
            // unmuteAllowed: not part of .self
          }
        );
      }
      if (parsedSelves.updates.localAudioUnmuteRequiredByServer) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUIRED,
          {
            muted: parsedSelves.current.remoteMuted,
            unmuteAllowed: parsedSelves.current.unmuteAllowed,
          }
        );
      }
      if (parsedSelves.updates.isMutedByOthersChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {
            muted: parsedSelves.current.remoteMuted,
            unmuteAllowed: parsedSelves.current.unmuteAllowed,
          }
        );
      }
      if (parsedSelves.updates.localAudioUnmuteRequestedByServer) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED,
          {}
        );
      }
      if (parsedSelves.updates.isUserUnadmitted) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_UNADMITTED_GUEST,
          self
        );
      }
      if (parsedSelves.updates.isUserAdmitted) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_ADMITTED_GUEST,
          self
        );
      }

      if (parsedSelves.updates.isMediaInactive) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          // @ts-ignore
          LOCUSINFO.EVENTS.MEDIA_INACTIVITY,
          SelfUtils.getMediaStatus(self.mediaSessions)
        );
      }

      if (
        parsedSelves.updates.audioStateChange ||
        parsedSelves.updates.videoStateChange ||
        parsedSelves.updates.shareStateChange
      ) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.MEDIA_STATUS_CHANGE,
          {
            audioStatus: parsedSelves.current.currentMediaStatus?.audio,
            videoStatus: parsedSelves.current.currentMediaStatus?.video,
            shareStatus: parsedSelves.current.currentMediaStatus?.share,
          }
        );
      }

      if (parsedSelves.updates.isUserObserving) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_OBSERVING
        );
      }

      if (parsedSelves.updates.canNotViewTheParticipantListChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE,
          {canNotViewTheParticipantList: parsedSelves.current.canNotViewTheParticipantList}
        );
      }

      if (parsedSelves.updates.isSharingBlockedChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf',
          },
          LOCUSINFO.EVENTS.SELF_IS_SHARING_BLOCKED_CHANGE,
          {isSharingBlocked: parsedSelves.current.isSharingBlocked}
        );
      }

      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateSelf',
        },
        EVENTS.LOCUS_INFO_UPDATE_SELF,
        {
          oldSelf: parsedSelves.previous,
          newSelf: parsedSelves.current,
        }
      );
      this.parsedLocus.self = parsedSelves.current;
      // @ts-ignore
      this.self = self;
    } else {
      this.compareAndUpdateFlags.compareHostAndSelf = false;
    }
  }

  /**
   * handles when the locus.url is updated
   * @param {String} url
   * @returns {undefined}
   * emits internal event locus_info_update_url
   */
  updateLocusUrl(url: string) {
    if (url && this.url !== url) {
      this.url = url;
      this.updateMeeting({locusUrl: url});
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateLocusUrl',
        },
        EVENTS.LOCUS_INFO_UPDATE_URL,
        url
      );
    }
  }

  /**
   * @param {String} aclUrl
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateAclUrl(aclUrl: string) {
    if (aclUrl && !isEqual(this.aclUrl, aclUrl)) {
      this.aclUrl = aclUrl;
    }
  }

  /**
   * @param {Number} baseSequence
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateBasequence(baseSequence: number) {
    if (baseSequence && !isEqual(this.baseSequence, baseSequence)) {
      this.baseSequence = baseSequence;
    }
  }

  /**
   * @param {Number} sequence
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateSequence(sequence: number) {
    if (sequence && !isEqual(this.sequence, sequence)) {
      this.sequence = sequence;
    }
  }

  /**
   * @param {Object} membership
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateMemberShip(membership: object) {
    if (membership && !isEqual(this.membership, membership)) {
      this.membership = membership;
    }
  }

  /**
   * @param {Array} identities
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateIdentifiers(identities: Array<any>) {
    if (identities && !isEqual(this.identities, identities)) {
      this.identities = identities;
    }
  }

  /**
   * check the locus is main session's one or not, if is main session's, update main session cache
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateLocusCache(locus: any) {
    const isMainSessionDTO = ControlsUtils.isMainSessionDTO(locus);
    if (isMainSessionDTO) {
      this.updateMainSessionLocusCache(locus);
    }
  }

  /**
   * if return from breakout to main session, need to use cached main session DTO since locus won't send the full locus (participants)
   * if join breakout from main session, main session is not active for the attendee and remove main session locus cache
   * @param {Object} newLocus
   * @returns {Object}
   * @memberof LocusInfo
   */
  getTheLocusToUpdate(newLocus: any) {
    const switchStatus = ControlsUtils.getSessionSwitchStatus(this.controls, newLocus?.controls);
    if (switchStatus.isReturnToMain && this.mainSessionLocusCache) {
      return cloneDeep(this.mainSessionLocusCache);
    }
    const isMainSessionDTO =
      this.mainSessionLocusCache && ControlsUtils.isMainSessionDTO(this.mainSessionLocusCache);

    if (isMainSessionDTO) {
      const isActive =
        [LOCUS.STATE.ACTIVE, LOCUS.STATE.INITIALIZING, LOCUS.STATE.TERMINATING].includes(
          this.fullState?.state
        ) && !this.mainSessionLocusCache?.self?.removed;

      if (!isActive) {
        this.clearMainSessionLocusCache();
      }
    }

    return newLocus;
  }

  /**
   * merge participants by participant id
   * @param {Array} participants
   * @param {Array} sourceParticipants
   * @returns {Array} merged participants
   * @memberof LocusInfo
   */
  // eslint-disable-next-line class-methods-use-this
  mergeParticipants(participants, sourceParticipants) {
    if (!sourceParticipants || !sourceParticipants.length) return participants;
    if (!participants || !participants.length) {
      return sourceParticipants;
    }
    sourceParticipants.forEach((participant) => {
      const existIndex = participants.findIndex((p) => p.id === participant.id);
      if (existIndex > -1) {
        participants.splice(existIndex, 1, participant);
      } else {
        participants.push(participant);
      }
    });

    return participants;
  }

  /**
   * need cache main sessions' participants since locus will not send the full list when cohost/host leave breakout
   * @param {Object} mainLocus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateMainSessionLocusCache(mainLocus: any) {
    if (!mainLocus) {
      return;
    }
    const locusClone = cloneDeep(mainLocus);
    if (this.mainSessionLocusCache) {
      // shallow merge and do special merge for participants
      assignWith(this.mainSessionLocusCache, locusClone, (objValue, srcValue, key) => {
        if (key === 'participants') {
          return this.mergeParticipants(objValue, srcValue);
        }

        return srcValue || objValue;
      });
    } else {
      this.mainSessionLocusCache = locusClone;
    }
  }

  /**
   * clear main session cache
   * @returns {undefined}
   * @memberof LocusInfo
   */
  clearMainSessionLocusCache() {
    this.mainSessionLocusCache = null;
  }
}
