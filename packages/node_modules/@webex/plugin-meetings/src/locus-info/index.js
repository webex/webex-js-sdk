import {isEqual} from 'lodash';

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
  RECORDING_STATE
} from '../constants';
import Metrics from '../metrics';
import {eventType} from '../metrics/config';
import InfoUtils from '../locus-info/infoUtils';
import FullState from '../locus-info/fullState';
import SelfUtils from '../locus-info/selfUtils';
import HostUtils from '../locus-info/hostUtils';
import ControlsUtils from '../locus-info/controlsUtils';
import EmbeddedAppsUtils from '../locus-info/embeddedAppsUtils';
import MediaSharesUtils from '../locus-info/mediaSharesUtils';
import LocusDeltaParser from '../locus-info/parser';


/**
 * @description LocusInfo extends ChildEmitter to convert locusInfo info a private emitter to parent object
 * @export
 * @private
 * @class LocusInfo
 */
export default class LocusInfo extends EventsScope {
  constructor(updateMeeting, webex, meetingId) {
    super();
    this.parsedLocus = {
      states: []
    };
    this.webex = webex;
    this.emitChange = false;
    this.compareAndUpdateFlags = {};
    this.meetingId = meetingId;
    this.updateMeeting = updateMeeting;
    this.locusParser = new LocusDeltaParser();
  }


  /**
   * Apply locus delta data to meeting
   * @param {string} action Locus delta action
   * @param {Locus} locus
   * @param {Meeting} meeting
   * @returns {undefined}
   */
  applyLocusDeltaData(action, locus, meeting) {
    const {DESYNC, USE_CURRENT, USE_INCOMING} = LocusDeltaParser.loci;

    switch (action) {
      case USE_INCOMING:
        meeting.locusInfo.onDeltaLocus(locus);
        break;
      case USE_CURRENT:
        meeting.locusDesync = false;
        meeting.needToGetFullLocus = false;
        break;
      case DESYNC:
        meeting.meetingRequest.getFullLocus({
          desync: true,
          locusUrl: meeting.locusUrl
        }).then((res) => {
          meeting.locusInfo.onFullLocus(res.body);
          // Notify parser to resume processing delta events
          // now that we have full locus from DESYNC.
          this.locusParser.resume();
        });
        break;
      default:
        LoggerProxy.logger.info(`Locus-info:index#applyLocusDeltaData --> Unknown locus delta action: ${action}`);
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
  handleLocusDelta(locus, meeting) {
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
  init(locus = {}) {
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

    // above section only updates the locusInfo object
    // The below section makes sure it updates the locusInfo as well as updates the meeting object
    this.updateParticipants(locus.participants);
    // For 1:1 space meeting the conversation Url does not exist in locus.conversation
    this.updateConversationUrl(locus.conversationUrl, locus.info);
    this.updateControls(locus.controls);
    this.updateLocusUrl(locus.url);
    this.updateFullState(locus.fullState);
    this.updateMeetingInfo(locus.info);
    this.updateEmbeddedApps(locus.embeddedApps);
    // self and participants generate sipUrl for 1:1 meeting
    this.updateSelf(locus.self, locus.participants);
    this.updateHostInfo(locus.host);
    this.updateMediaShares(locus.mediaShares);
  }

  /**
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  initialSetup(locus) {
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
  parse(meeting, data) {
    const {eventType} = data;

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
        this.onFullLocus(data.locus, eventType);
        break;
      case LOCUSEVENT.DIFFERENCE:
        this.handleLocusDelta(data.locus, meeting);
        break;

      default:
        // Why will there be a event with no eventType ????
        // we may not need this, we can get full locus
        this.handleLocusDelta(data.locus, meeting);
    }
  }

  /**
   * @param {String} scope
   * @param {String} eventName
   * @param {Array} args
   * @returns {undefined}
   * @memberof LocusInfo
   */
  emitScoped(scope, eventName, args) {
    return this.emit(scope, eventName, args);
  }

  /**
   * updates the locus with full locus object
   * @param {object} locus locus object
   * @param {sting} eventType particulat locus event
   * @returns {object} null
   * @memberof LocusInfo
   */
  onFullLocus(locus, eventType) {
    if (!locus) {
      LoggerProxy.logger.error('Locus-info:index#onFullLocus --> object passed as argument was invalid, continuing.');
    }
    this.updateParticipantDeltas(locus.participants);
    this.scheduledMeeting = locus.meeting || null;
    this.participants = locus.participants;
    this.updateLocusInfo(locus);
    this.updateParticipants(locus.participants);
    this.isMeetingActive();
    this.handleOneOnOneEvent(eventType);
    // set current (working copy) for parser
    this.locusParser.workingCopy = locus;
  }

  // used for ringing stops on one on one
  /**
   * @param {String} eventType
   * @returns {undefined}
   * @memberof LocusInfo
   */
  handleOneOnOneEvent(eventType) {
    if (this.parsedLocus.fullState.type === _CALL_ || this.parsedLocus.fullState.type === _SIP_BRIDGE_) {
    // for 1:1 bob calls alice and alice declines, notify the meeting state
      if (eventType === LOCUSEVENT.PARTICIPANT_DECLINED) {
      // trigger the event for stop ringing
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent'
          },
          EVENTS.REMOTE_RESPONSE,
          {
            remoteDeclined: true,
            remoteAnswered: false
          }
        );
      }
      // for 1:1 bob calls alice and alice answers, notify the meeting state
      if (eventType === LOCUSEVENT.PARTICIPANT_JOIN) {
      // trigger the event for stop ringing
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'handleOneonOneEvent'
          },
          EVENTS.REMOTE_RESPONSE,
          {
            remoteDeclined: false,
            remoteAnswered: true
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
  onDeltaLocus(locus) {
    this.updateLocusInfo(locus);
    this.updateParticipants(locus.participants);
    this.isMeetingActive();
  }

  /**
   * @param {Object} locus
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateLocusInfo(locus) {
    this.updateControls(locus.controls);
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
    this.compareAndUpdate();
    // update which required to compare different objects from locus
  }

  /**
   * @param {Array} participants
   * @param {Object} self
   * @returns {Array}
   * @memberof LocusInfo
   */
  getLocusPartner(participants, self) {
    if (!participants || participants.length === 0) {
      return null;
    }

    return participants.find((participant) =>
      (self && participant.identity !== self.identity) &&
  (participants.length <= 2 || (participant.type === _USER_ && !participant.removed))) || this.partner;
  }

  // TODO: all the leave states need to be checked
  /**
   * @returns {undefined}
   * @memberof LocusInfo
   */
  isMeetingActive() {
    if ((this.parsedLocus.fullState.type === _CALL_) || (this.parsedLocus.fullState.type === _SIP_BRIDGE_)) {
      const partner = this.getLocusPartner(this.participants, this.self);

      this.updateMeeting({partner});

      // Check if guest user needs to be checked here

      // 1) when bob declines call from bob, (bob='DECLINED')
      // 2) When alice rejects call to bob , (bob='NOTIFIED')

      // When we dont add MEDIA for condition 2. The state of bob='IDLE'

      if (this.fullState && this.fullState.state === LOCUS.STATE.INACTIVE) {
        // TODO: update the meeting state
        LoggerProxy.logger.warn('Locus-info:index#isMeetingActive --> Call Ended, locus state is inactive.');
        Metrics.postEvent({
          event: eventType.REMOTE_ENDED,
          meetingId: this.meetingId
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.CALL_INACTIVE,
            shouldLeave: false
          }
        );
      }
      else
      if (partner.state === MEETING_STATE.STATES.LEFT &&
        this.parsedLocus.self &&
        (this.parsedLocus.self.state === MEETING_STATE.STATES.DECLINED ||
        this.parsedLocus.self.state === MEETING_STATE.STATES.NOTIFIED ||
        this.parsedLocus.self.state === MEETING_STATE.STATES.JOINED)) {
        Metrics.postEvent({
          event: eventType.REMOTE_ENDED,
          meetingId: this.meetingId
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.PARTNER_LEFT,
            shouldLeave: this.parsedLocus.self.joinedWith && this.parsedLocus.self.joinedWith.state !== _LEFT_
          }
        );
      }
      else
      if (this.parsedLocus.self &&
        this.parsedLocus.self.state === MEETING_STATE.STATES.LEFT &&
      (partner.state === MEETING_STATE.STATES.LEFT ||
      partner.state === MEETING_STATE.STATES.DECLINED ||
      partner.state === MEETING_STATE.STATES.NOTIFIED ||
      partner.state === MEETING_STATE.STATES.IDLE) // Happens when user just joins and adds no Media
      ) {
        Metrics.postEvent({
          event: eventType.REMOTE_ENDED,
          meetingId: this.meetingId
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: CALL_REMOVED_REASON.SELF_LEFT,
            shouldLeave: false
          }
        );
      }
    }
    else if (this.parsedLocus.fullState.type === _MEETING_) {
      if (this.fullState && (this.fullState.state === LOCUS.STATE.INACTIVE || this.fullState.state === LOCUS.STATE.TERMINATING)) {
        LoggerProxy.logger.warn('Locus-info:index#isMeetingActive --> Meeting is ending due to inactive or terminating');
        Metrics.postEvent({
          event: eventType.REMOTE_ENDED,
          meetingId: this.meetingId
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.MEETING_INACTIVE_TERMINATING,
            shouldLeave: false
          }
        );
      }
      else if (this.fullState && this.fullState.removed) {
        // user has been dropped from a meeting
        Metrics.postEvent({
          event: eventType.REMOTE_ENDED,
          meetingId: this.meetingId
        });
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.FULLSTATE_REMOVED,
            shouldLeave: false
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
            function: 'isMeetingActive'
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: MEETING_REMOVED_REASON.SELF_REMOVED,
            shouldLeave: false
          }
        );
      }
    }
    else {
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
    if (this.compareAndUpdateFlags.compareSelfAndHost || this.compareAndUpdateFlags.compareHostAndSelf) {
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
    if ((this.parsedLocus.self.selfIdentity === this.parsedLocus.host?.hostId) && this.parsedLocus.self.moderator) {
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'compareSelfAndHost'
        },
        EVENTS.LOCUS_INFO_CAN_ASSIGN_HOST,
        {
          canAssignHost: true
        }
      );
    }
    else {
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'compareSelfAndHost'
        },
        EVENTS.LOCUS_INFO_CAN_ASSIGN_HOST,
        {
          canAssignHost: false
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
  updateParticipantDeltas(participants = []) {
    // Used to find a participant within a participants collection.
    const findParticipant = (participant, collection) =>
      collection.find((item) => item.person.id === participant.person.id);

    // Generates an object that indicates which state properties have changed.
    const generateDelta = (prevState = {}, newState = {}) => {
      // Setup deltas.
      const deltas = {
        audioStatus: prevState.audioStatus !== newState.audioStatus,
        videoSlidesStatus: prevState.videoSlidesStatus !== newState.videoSlidesStatus,
        videoStatus: prevState.videoStatus !== newState.videoStatus
      };

      // Clean the object
      Object.keys(deltas).forEach(
        (key) => {
          if (deltas[key] !== true) {
            delete deltas[key];
          }
        }
      );

      return deltas;
    };

    this.deltaParticipants = participants.reduce(
      (collection, participant) => {
        const existingParticipant = findParticipant(
          participant,
          this.participants || []
        ) || {};

        const delta = generateDelta(existingParticipant.status, participant.status);

        const changed = (Object.keys(delta).length > 0);

        if (changed) {
          collection.push({
            person: participant.person,
            delta
          });
        }

        return collection;
      }, []
    );
  }

  /**
   *
   * @param {Object} participants new participants object
   * @param {boolen} deltaParticpantFlag  delta event
   * @returns {Array} updatedParticipants
   * @memberof LocusInfo
   */
  updateParticipants(participants) {
    this.emitScoped(
      {
        file: 'locus-info',
        function: 'updateParticipants'
      },
      EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS,
      {
        participants,
        recordingId: this.parsedLocus.controls && this.parsedLocus.controls.record?.modifiedBy,
        selfIdentity: this.parsedLocus.self && this.parsedLocus.self.selfIdentity,
        selfId: this.parsedLocus.self && this.parsedLocus.self.selfId,
        hostId: this.parsedLocus.host && this.parsedLocus.host.hostId
      }
    );
  }

  /**
   * @param {Object} controls
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateControls(controls) {
    if (controls && !isEqual(this.controls, controls)) {
      this.parsedLocus.controls = ControlsUtils.parse(controls);
      const {
        updates: {
          hasRecordingChanged,
          hasRecordingPausedChanged,
          hasMeetingContainerChanged,
          hasTranscribeChanged
        },
        current
      } = ControlsUtils.getControls(this.controls, controls);

      if (hasRecordingChanged || hasRecordingPausedChanged) {
        let state = null;

        if (hasRecordingPausedChanged) {
          if (current.record.paused) {
            state = RECORDING_STATE.PAUSED;
          }
          else {
            // state will be `IDLE` if the recording is not active, even when there is a `pause` status change.
            state = current.record.recording ? RECORDING_STATE.RESUMED : RECORDING_STATE.IDLE;
          }
        }
        else if (hasRecordingChanged) {
          state = current.record.recording ? RECORDING_STATE.RECORDING : RECORDING_STATE.IDLE;
        }

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls'
          },
          LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
          {
            state,
            modifiedBy: current.record.modifiedBy,
            lastModified: current.record.lastModified
          }
        );
      }

      if (hasMeetingContainerChanged) {
        const {meetingContainerUrl} = current.meetingContainer;

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls'
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
          {
            meetingContainerUrl
          }
        );
      }

      if (hasTranscribeChanged) {
        const {transcribing, caption} = current.transcribe;

        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateControls'
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_TRANSCRIBE_UPDATED,
          {
            transcribing, caption
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
  updateConversationUrl(conversationUrl, info) {
    if (conversationUrl && !isEqual(this.conversationUrl, conversationUrl)) {
      this.conversationUrl = conversationUrl;
      this.updateMeeting({conversationUrl});
    }
    else if (info && info.conversationUrl && !isEqual(this.conversationUrl, info.conversationUrl)) {
      this.conversationUrl = info.conversationUrl;
      this.updateMeeting({conversationUrl: info.conversationUrl});
    }
  }

  /**
   * @param {Object} created
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateCreated(created) {
    if (created && !isEqual(this.created, created)) {
      this.created = created;
    }
  }


  /**
   * @param {Object} fullState
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateFullState(fullState) {
    if (fullState && !isEqual(this.fullState, fullState)) {
      const result = FullState.getFullState(this.fullState, fullState);

      this.updateMeeting(result.current);

      if (result.updates.meetingStateChangedTo) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateFullState'
          },
          LOCUSINFO.EVENTS.FULL_STATE_MEETING_STATE_CHANGE,
          {
            previousState: result.previous && result.previous.meetingState,
            currentState: result.current.meetingState
          }
        );
      }

      if (result.updates.meetingTypeChangedTo) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateFullState'
          },
          LOCUSINFO.EVENTS.FULL_STATE_TYPE_UPDATE,
          {
            type: result.current.type
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
  updateHostInfo(host) {
    if (host && !isEqual(this.host, host)) {
      const parsedHosts = HostUtils.getHosts(this.host, host);

      this.updateMeeting(parsedHosts.current);
      this.parsedLocus.host = parsedHosts.current;
      if (parsedHosts.updates.isNewHost) {
        this.compareAndUpdateFlags.compareSelfAndHost = true;
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateHostInfo'
          },
          EVENTS.LOCUS_INFO_UPDATE_HOST,
          {
            newHost: parsedHosts.current,
            oldHost: parsedHosts.previous
          }
        );
      }
      this.host = host;
    }
    else {
      this.compareAndUpdateFlags.compareSelfAndHost = false;
    }
  }

  /**
   * @param {Object} info
   * @param {Object} self
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateMeetingInfo(info, self) {
    if (info && (!isEqual(this.info, info))) {
      const roles = self ? SelfUtils.getRoles(self) : this.parsedLocus.self?.roles || [];
      const isJoined = SelfUtils.isJoined(self || this.parsedLocus.self);
      const parsedInfo = InfoUtils.getInfos(this.parsedLocus.info, info, roles, isJoined);

      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateMeetingInfo'
        },
        LOCUSINFO.EVENTS.MEETING_INFO_UPDATED,
        {info: parsedInfo.current, self}
      );

      if (parsedInfo.updates.isLocked) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateMeetingInfo'
          },
          LOCUSINFO.EVENTS.MEETING_LOCKED,
          info
        );
      }
      if (parsedInfo.updates.isUnlocked) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateMeetingInfo'
          },
          LOCUSINFO.EVENTS.MEETING_UNLOCKED,
          info
        );
      }

      this.info = info;
      this.parsedLocus.info = parsedInfo.current;
      // Parses the info and adds necessary values
      this.updateMeeting(parsedInfo.current);
    }
  }

  /**
   * @param {Object} embeddedApps
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateEmbeddedApps(embeddedApps) {
    // don't do anything if the arrays of apps haven't changed significantly
    if (EmbeddedAppsUtils.areSimilar(this.embeddedApps, embeddedApps)) {
      return;
    }

    this.parsedLocus.embeddedApps = EmbeddedAppsUtils.parse(embeddedApps);

    this.emitScoped(
      {
        file: 'locus-info',
        function: 'updateEmbeddedApps'
      },
      LOCUSINFO.EVENTS.EMBEDDED_APPS_UPDATED,
      embeddedApps
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
  updateMediaShares(mediaShares) {
    if (mediaShares && !isEqual(this.mediaShares, mediaShares)) {
      const parsedMediaShares = MediaSharesUtils.getMediaShares(this.mediaShares, mediaShares);

      this.updateMeeting(parsedMediaShares.current);
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateMediaShares'
        },
        EVENTS.LOCUS_INFO_UPDATE_MEDIA_SHARES,
        {
          current: parsedMediaShares.current,
          previous: parsedMediaShares.previous
        }
      );
      this.parsedLocus.mediaShares = parsedMediaShares.current;
      this.mediaShares = mediaShares;
    }
  }

  /**
   * @param {String} participantsUrl
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateParticipantsUrl(participantsUrl) {
    if (participantsUrl && !isEqual(this.participantsUrl, participantsUrl)) {
      this.participantsUrl = participantsUrl;
    }
  }

  /**
   * @param {Object} replace
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateReplace(replace) {
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
  updateSelf(self, participants) {
    if (self && !isEqual(this.self, self)) {
      const parsedSelves = SelfUtils.getSelves(this.self, self, this.webex.internal.device.url);

      this.updateMeeting(parsedSelves.current);
      this.parsedLocus.self = parsedSelves.current;

      const element = this.parsedLocus.states[this.parsedLocus.states.length - 1];

      if (element !== parsedSelves.current.state) {
        this.parsedLocus.states.push(parsedSelves.current.state);
      }

      // TODO: check if we need to save the sipUri here as well
      // this.emit(LOCUSINFO.EVENTS.MEETING_UPDATE, SelfUtils.getSipUrl(this.getLocusPartner(participants, self), this.parsedLocus.fullState.type, this.parsedLocus.info.sipUri));
      const result = SelfUtils.getSipUrl(this.getLocusPartner(participants, self), this.parsedLocus.fullState.type, this.parsedLocus.info.sipUri);

      if (result.sipUri) {
        this.updateMeeting(result);
      }

      if (parsedSelves.updates.moderatorChanged) {
        this.compareAndUpdateFlags.compareHostAndSelf = true;
      }
      else {
        this.compareAndUpdateFlags.compareHostAndSelf = false;
      }

      if (parsedSelves.updates.layoutChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED,
          {layout: parsedSelves.current.layout}
        );
      }

      if (parsedSelves.updates.isMediaInactiveOrReleased) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.DISCONNECT_DUE_TO_INACTIVITY,
          {reason: self.reason}
        );
      }

      if (parsedSelves.updates.moderatorChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.SELF_MODERATOR_CHANGED,
          self
        );
      }
      if (parsedSelves.updates.localAudioUnmuteRequiredByServer) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUIRED,
          {
            muted: parsedSelves.current.remoteMuted,
            unmuteAllowed: parsedSelves.current.unmuteAllowed
          }
        );
      }
      if (parsedSelves.updates.isMutedByOthersChanged) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED,
          {
            muted: parsedSelves.current.remoteMuted,
            unmuteAllowed: parsedSelves.current.unmuteAllowed
          }
        );
      }
      if (parsedSelves.updates.localAudioUnmuteRequestedByServer) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED,
          {}
        );
      }
      if (parsedSelves.updates.isUserUnadmitted) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.SELF_UNADMITTED_GUEST,
          self
        );
      }
      if (parsedSelves.updates.isUserAdmitted) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.SELF_ADMITTED_GUEST,
          self
        );
      }

      if (parsedSelves.updates.isMediaInactive) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.MEDIA_INACTIVITY,
          SelfUtils.getMediaStatus(self.mediaSessions)
        );
      }

      if (parsedSelves.updates.audioStateChange || parsedSelves.updates.videoStateChange || parsedSelves.updates.shareStateChange) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.MEDIA_STATUS_CHANGE,
          {
            audioStatus: parsedSelves.current.currentMediaStatus?.audio,
            videoStatus: parsedSelves.current.currentMediaStatus?.video,
            shareStatus: parsedSelves.current.currentMediaStatus?.share
          }
        );
      }

      if (parsedSelves.updates.isUserObserving) {
        this.emitScoped(
          {
            file: 'locus-info',
            function: 'updateSelf'
          },
          LOCUSINFO.EVENTS.SELF_OBSERVING
        );
      }


      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateSelf'
        },
        EVENTS.LOCUS_INFO_UPDATE_SELF,
        {
          oldSelf: parsedSelves.previous,
          newSelf: parsedSelves.current
        }
      );
      this.parsedLocus.self = parsedSelves.current;
      this.self = self;
    }
    else {
      this.compareAndUpdateFlags.compareHostAndSelf = false;
    }
  }

  /**
   * handles when the locus.url is updated
   * @param {String} url
   * @returns {undefined}
   * emits internal event locus_info_update_url
   */
  updateLocusUrl(url) {
    if (url && this.url !== url) {
      this.url = url;
      this.updateMeeting({locusUrl: url});
      this.emitScoped(
        {
          file: 'locus-info',
          function: 'updateLocusUrl'
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
  updateAclUrl(aclUrl) {
    if (aclUrl && !isEqual(this.aclUrl, aclUrl)) {
      this.aclUrl = aclUrl;
    }
  }

  /**
   * @param {Number} baseSequence
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateBasequence(baseSequence) {
    if (baseSequence && !isEqual(this.baseSequence, baseSequence)) {
      this.baseSequence = baseSequence;
    }
  }

  /**
   * @param {Number} sequence
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateSequence(sequence) {
    if (sequence && !isEqual(this.sequence, sequence)) {
      this.sequence = sequence;
    }
  }

  /**
   * @param {Object} membership
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateMemberShip(membership) {
    if (membership && !isEqual(this.membership, membership)) {
      this.membership = membership;
    }
  }

  /**
   * @param {Array} identities
   * @returns {undefined}
   * @memberof LocusInfo
   */
  updateIdentifiers(identities) {
    if (identities && !isEqual(this.identities, identities)) {
      this.identities = identities;
    }
  }
}
