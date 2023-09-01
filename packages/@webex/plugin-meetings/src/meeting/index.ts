import uuid from 'uuid';
import {cloneDeep, isEqual, defer, isEmpty} from 'lodash';
import jwt from 'jsonwebtoken';
// @ts-ignore - Fix this
import {StatelessWebexPlugin} from '@webex/webex-core';
import {ClientEvent, CALL_DIAGNOSTIC_CONFIG} from '@webex/internal-plugin-metrics';
import {
  ConnectionState,
  Errors,
  ErrorType,
  Event,
  MediaContent,
  MediaType,
  RemoteTrackType,
} from '@webex/internal-media-core';

import {
  getDevices,
  LocalTrack,
  LocalCameraTrack,
  LocalDisplayTrack,
  LocalSystemAudioTrack,
  LocalMicrophoneTrack,
  LocalTrackEvents,
  TrackMuteEvent,
} from '@webex/media-helpers';

import {
  MeetingNotActiveError,
  UserInLobbyError,
  NoMediaEstablishedYetError,
  UserNotJoinedError,
} from '../common/errors/webex-errors';
import {StatsAnalyzer, EVENTS as StatsAnalyzerEvents} from '../statsAnalyzer';
import NetworkQualityMonitor from '../networkQualityMonitor';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import Roap from '../roap/index';
import Media, {type BundlePolicy} from '../media';
import MediaProperties from '../media/properties';
import MeetingStateMachine from './state';
import {createMuteState} from './muteState';
import LocusInfo from '../locus-info';
import Metrics from '../metrics';
import ReconnectionManager from '../reconnection-manager';
import MeetingRequest from './request';
import Members from '../members/index';
import MeetingUtil from './util';
import RecordingUtil from '../recording-controller/util';
import ControlsOptionsUtil from '../controls-options-manager/util';
import MediaUtil from '../media/util';
import Transcription from '../transcription';
import {Reactions, SkinTones} from '../reactions/reactions';
import PasswordError from '../common/errors/password-error';
import CaptchaError from '../common/errors/captcha-error';
import ReconnectionError from '../common/errors/reconnection';
import ReconnectInProgress from '../common/errors/reconnection-in-progress';
import {
  _CALL_,
  _INCOMING_,
  _JOIN_,
  AUDIO,
  CONTENT,
  DISPLAY_HINTS,
  ENDED,
  EVENT_TRIGGERS,
  EVENT_TYPES,
  EVENTS,
  BREAKOUTS,
  FLOOR_ACTION,
  FULL_STATE,
  LAYOUT_TYPES,
  LOCUSINFO,
  MEETING_INFO_FAILURE_REASON,
  MEETING_REMOVED_REASON,
  MEETING_STATE_MACHINE,
  MEETING_STATE,
  MEETINGS,
  MQA_STATS,
  NETWORK_STATUS,
  ONLINE,
  OFFLINE,
  PASSWORD_STATUS,
  PSTN_STATUS,
  QUALITY_LEVELS,
  RECORDING_STATE,
  SHARE_STATUS,
  SHARE_STOPPED_REASON,
  VIDEO,
  HTTP_VERBS,
  SELF_ROLES,
  INTERPRETATION,
  SELF_POLICY,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import ParameterError from '../common/errors/parameter';
import {
  MeetingInfoV2PasswordError,
  MeetingInfoV2CaptchaError,
  MeetingInfoV2PolicyError,
} from '../meeting-info/meeting-info-v2';
import BrowserDetection from '../common/browser-detection';
import {CSI, ReceiveSlotManager} from '../multistream/receiveSlotManager';
import {MediaRequestManager} from '../multistream/mediaRequestManager';
import {
  Configuration as RemoteMediaManagerConfiguration,
  RemoteMediaManager,
  Event as RemoteMediaManagerEvent,
} from '../multistream/remoteMediaManager';
import {
  Reaction,
  ReactionServerType,
  SkinToneType,
  ProcessedReaction,
  RelayEvent,
} from '../reactions/reactions.type';
import Breakouts from '../breakouts';
import SimultaneousInterpretation from '../interpretation';
import Annotation from '../annotation';

import InMeetingActions from './in-meeting-actions';
import {REACTION_RELAY_TYPES} from '../reactions/constants';
import RecordingController from '../recording-controller';
import ControlsOptionsManager from '../controls-options-manager';
import PermissionError from '../common/errors/permission';
import {LocusMediaRequest} from './locusMediaRequest';
import {AnnotationInfo} from '../annotation/annotation.types';

const {isBrowser} = BrowserDetection();

const logRequest = (request: any, {logText = ''}) => {
  LoggerProxy.logger.info(`${logText} - sending request`);

  return request
    .then((arg) => {
      LoggerProxy.logger.info(`${logText} - has been successfully sent`);

      return arg;
    })
    .catch((error) => {
      LoggerProxy.logger.error(`${logText} - has failed: `, error);
      throw error;
    });
};

export type LocalTracks = {
  microphone?: LocalMicrophoneTrack;
  camera?: LocalCameraTrack;
  screenShare?: {
    audio?: LocalSystemAudioTrack;
    video?: LocalDisplayTrack;
  };
  annotationInfo?: AnnotationInfo;
};

export type AddMediaOptions = {
  localTracks?: LocalTracks;
  audioEnabled?: boolean; // if not specified, default value true is used
  videoEnabled?: boolean; // if not specified, default value true is used
  receiveShare?: boolean; // if not specified, default value true is used
  remoteMediaManagerConfig?: RemoteMediaManagerConfiguration; // applies only to multistream meetings
  bundlePolicy?: BundlePolicy; // applies only to multistream meetings
  allowMediaInLobby?: boolean; // allows adding media when in the lobby
};

export const MEDIA_UPDATE_TYPE = {
  TRANSCODED_MEDIA_CONNECTION: 'TRANSCODED_MEDIA_CONNECTION',
  SHARE_FLOOR_REQUEST: 'SHARE_FLOOR_REQUEST',
  UPDATE_MEDIA: 'UPDATE_MEDIA',
};

export enum ScreenShareFloorStatus {
  PENDING = 'floor_request_pending',
  GRANTED = 'floor_request_granted',
  RELEASED = 'floor_released',
}

/**
 * MediaDirection
 * @typedef {Object} MediaDirection
 * @property {boolean} sendAudio
 * @property {boolean} receiveAudio
 * @property {boolean} sendVideo
 * @property {boolean} receiveVideo
 * @property {boolean} sendShare
 * @property {boolean} receiveShare
 * @property {boolean} isSharing
 */

/**
 * SharePreferences
 * @typedef {Object} SharePreferences
 * @property {Object} [shareConstraints]
 * @property {Boolean} [highFrameRate]
 */

/**
 * JoinOptions
 * @typedef {Object} JoinOptions
 * @property {String} [resourceId]
 * @property {String} [pin]
 * @property {Boolean} [moderator]
 * @property {String|Object} [meetingQuality]
 * @property {String} [meetingQuality.remote]
 * @property {Boolean} [rejoin]
 * @property {Boolean} [enableMultistream]
 */

/**
 * Recording
 * @typedef {Object} Recording
 * @property {Object} state
 * @property {String} modifiedBy
 */

/**
 * Meeting State Change Event
 * Emitted when ever there is a meeting state change
 * @event meeting:stateChange
 * @instance
 * @type {Object}
 * @property {String} currentState current state of the meeting
 * @property {String} previousState previous state of the meeting
 * @memberof Meeting
 */

/**
 * Media Ready Event
 * Emitted when a stream is ready to be rendered
 * @event media:ready
 * @instance
 * @type {Object}
 * @property {MediaStream} stream the media stream
 * @property {String} type what type of stream, remote, local
 * @memberof Meeting
 */

/**
 * Media Stopped Event
 * Emitted when a stream has stopped sending
 * @event media:stopped
 * @instance
 * @type {Object}
 * @property {String} type what type of stream, remote, local
 * @memberof Meeting
 */

/**
 * Meeting Ringing Event
 * Emitted when this client should play a ringing sound, because this member is getting an incoming meeting
 * or sending out an incoming meeting
 * @event meeting:ringing
 * @instance
 * @type {Object}
 * @property {String} type // INCOMING or JOIN
 * @property {String} id
 * @memberof Meeting
 */

/**
 * Meeting Ringing Stop Event
 * Emitted when this client should stop playing a ringing sound
 * @event meeting:ringingStop
 * @instance
 * @type {Object}
 * @property {Object} type
 * @property {Boolean} type.remoteAnswered
 * @property {Boolean} type.remoteDeclined
 * @property {String} id
 * @memberof Meeting
 */

/**
 * Meeting Started Sharing Local Event
 * Emitted when this member starts sharing
 * @event meeting:startedSharingLocal
 * @instance
 * @type {Object}
 * @memberof Meeting
 */

/**
 * Meeting Stopped Sharing Local Event
 * Emitted when this member stops sharing
 * @event meeting:stoppedSharingLocal
 * @instance
 * @type {Object}
 * @memberof Meeting
 */

/**
 * Meeting Started Sharing Remote Event
 * Emitted when remote sharing starts
 * @event meeting:startedSharingRemote
 * @instance
 * @type {Object}
 * @property {Boolean} memberId id of the meeting member that started screen share
 * @property {String}  url of this content share
 * @property {String}  shareInstanceId of this content share
 * @property {Object}  annotation Info of this content share
 * @memberof Meeting
 *
 */

/**
 * Meeting Stopped Sharing Remote Event
 * Emitted when remote screen sharing ends
 * @event meeting:stoppedSharingRemote
 * @instance
 * @type {Object}
 * @memberof Meeting
 */

/**
 * Meeting Locked Event
 * Emitted when a meeting is locked
 * @event meeting:locked
 * @instance
 * @type {Object}
 * @property {Object} info
 * @memberof Meeting
 */

/**
 * Meeting Unlocked Event
 * Emitted when a meeting is unlocked
 * @event meeting:unlocked
 * @instance
 * @type {Object}
 * @property {Object} info
 * @memberof Meeting
 */

/**
 * Meeting Actions Update Event
 * Emitted when a user can take actions on a meeting such as lock, unlock, assign host
 * @event meeting:actionsUpdate
 * @instance
 * @type {Object}
 * @property {Boolean} canLock
 * @property {Boolean} canUnlock
 * @property {Boolean} canAssignHost
 * @memberof Meeting
 */

/**
 * Meeting Unmuted By Others Event
 * Emitted when a member is unmuted by another member
 * @event meeting:self:unmutedByOthers
 * @instance
 * @type {Object}
 * @property {Object} payload
 * @memberof Meeting
 */

/**
 * Meeting Muted By Others Event
 * Emitted when a member is muted by another member
 * @event meeting:self:mutedByOthers
 * @instance
 * @type {Object}
 * @property {Object} payload
 * @property {Boolean} payload.unmuteAllowed - whether the user is allowed to unmute self
 * @memberof Meeting
 */

/**
 * Meeting Muted By Others Event
 * Emitted when the host(moderator)/co-host requests a user to unmute
 * @event meeting:self:requestedToUnmute
 * @instance
 * @type {Object}
 * @property {Object} payload
 * @memberof Meeting
 */

/**
 * Meeting Self Guest Admitted Event
 * Emitted when a joined user get admitted to the meeting by another member or host
 * @event meeting:self:guestAdmitted
 * @instance
 * @type {Object}
 * @property {Object} payload
 * @memberof Meeting
 */

/**
 * Meeting Self Lobby Waiting Event
 * Emitted when joined user enters the lobby and is waiting for the webex meeting to begin
 * @event meeting:self:lobbyWaiting
 * @instance
 * @type {Object}
 * @property {Object} reason Reason why user left the meeting
 * @memberof Meeting
 */

/**
 * Meeting Self Left State
 * Emitted when user is inactive for more then 40 seconds, User can rejoin the meeting again
 * @event meeting:self:left
 * @instance
 * @type {Object}
 * @property {Object} payload
 * @memberof Meeting
 */

/**
 * Reconnection Starting Event
 * Emitted when reconnection of media to the active meeting was successful
 * @event meeting:reconnectionStarting
 * @instance
 * @memberof Meeting
 */

/**
 * Reconnection Success Event
 * Emitted when reconnection of media to the active meeting was successful
 * @event meeting:reconnectionSuccess
 * @instance
 * @type {Object}
 * @property {Object} reconnect
 * @memberof Meeting
 */

/**
 * Reconnection Failure Event
 * Emitted when reconnection of media to the active meeting was successful
 * @event meeting:reconnectionFailure
 * @instance
 * @type {Object}
 * @property {Error} error
 * @memberof Meeting
 */

/**
 * Meeting network quality event
 * Emitted on each interval of retrieving stats Analyzer data
 * @event network:quality
 * @type {Object}
 * @property {string} mediaType {video|audio}
 * @property {number} networkQualityScore - {1|0} 1 indicates acceptable uplink 0 indicates unacceptable uplink based on threshold
 * @memberof Meeting
 */

/**
 * @description Meeting is the crux of the plugin
 * @export
 * @class Meeting
 */
export default class Meeting extends StatelessWebexPlugin {
  attrs: any;
  audio: any;
  breakouts: any;
  simultaneousInterpretation: any;
  annotation: any;
  conversationUrl: string;
  correlationId: string;
  destination: string;
  destinationType: string;
  deviceUrl: string;
  hostId: string;
  id: string;
  isMultistream: boolean;
  locusUrl: string;
  mediaConnections: any[];
  mediaId?: string;
  meetingFiniteStateMachine: any;
  meetingInfo: any;
  meetingRequest: MeetingRequest;
  members: Members;
  options: object;
  orgId: string;
  owner: string;
  partner: any;
  policy: string;
  reconnectionManager: ReconnectionManager;
  resource: string;
  roap: Roap;
  roapSeq: number;
  selfUrl?: string; // comes from Locus, initialized by updateMeetingObject()
  sipUri: string;
  type: string;
  userId: string;
  video: any;
  callEvents: any[];
  deferJoin: Promise<any>;
  dialInDeviceStatus: string;
  dialInUrl: string;
  dialOutDeviceStatus: string;
  dialOutUrl: string;
  fetchMeetingInfoTimeoutId: NodeJS.Timeout;
  floorGrantPending: boolean;
  hasJoinedOnce: boolean;
  hasWebsocketConnected: boolean;
  inMeetingActions: InMeetingActions;
  isLocalShareLive: boolean;
  isRoapInProgress: boolean;
  keepAliveTimerId: NodeJS.Timeout;
  lastVideoLayoutInfo: any;
  locusInfo: any;
  locusMediaRequest?: LocusMediaRequest;
  mediaProperties: MediaProperties;
  mediaRequestManagers: {
    audio: MediaRequestManager;
    video: MediaRequestManager;
    screenShareAudio: MediaRequestManager;
    screenShareVideo: MediaRequestManager;
  };

  meetingInfoFailureReason: string;
  meetingInfoFailureCode?: number;
  networkQualityMonitor: NetworkQualityMonitor;
  networkStatus: string;
  passwordStatus: string;
  queuedMediaUpdates: any[];
  recording: any;
  remoteMediaManager: RemoteMediaManager | null;
  recordingController: RecordingController;
  controlsOptionsManager: ControlsOptionsManager;
  requiredCaptcha: any;
  receiveSlotManager: ReceiveSlotManager;
  selfUserPolicies: any;
  shareStatus: string;
  screenShareFloorState: ScreenShareFloorStatus;
  statsAnalyzer: StatsAnalyzer;
  transcription: Transcription;
  updateMediaConnections: (mediaConnections: any[]) => void;
  endCallInitJoinReq: any;
  endJoinReqResp: any;
  endLocalSDPGenRemoteSDPRecvDelay: any;
  joinedWith: any;
  locusId: any;
  startCallInitJoinReq: any;
  startJoinReqResp: any;
  startLocalSDPGenRemoteSDPRecvDelay: any;
  wirelessShare: any;
  guest: any;
  meetingJoinUrl: any;
  meetingNumber: any;
  meetingState: any;
  permissionToken: any;
  resourceId: any;
  resourceUrl: string;
  selfId: string;
  state: any;
  localAudioTrackMuteStateHandler: (event: TrackMuteEvent) => void;
  localVideoTrackMuteStateHandler: (event: TrackMuteEvent) => void;
  underlyingLocalTrackChangeHandler: () => void;
  roles: any[];
  environment: string;
  namespace = MEETINGS;
  annotationInfo: AnnotationInfo;
  allowMediaInLobby: boolean;

  /**
   * @param {Object} attrs
   * @param {Object} options
   * @constructor
   * @memberof Meeting
   */
  constructor(attrs: any, options: object) {
    super({}, options);
    /**
     * @instance
     * @type {Object}
     * @readonly
     * @private
     * @memberof Meeting
     */
    this.attrs = attrs;
    /**
     * @instance
     * @type {Object}
     * @readonly
     * @private
     * @memberof Meeting
     */
    this.options = options;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.id = uuid.v4();
    /**
     * Correlation ID used for network tracking of meeting
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    if (attrs.correlationId) {
      LoggerProxy.logger.log(
        `Meetings:index#constructor --> Initializing the meeting object with correlation id from app ${this.correlationId}`
      );
      this.correlationId = attrs.correlationId;
    } else {
      this.correlationId = this.id;
    }
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.userId = attrs.userId;
    /**
     * Organization ID
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.orgId = attrs.orgId;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.resource = attrs.resource;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.deviceUrl = attrs.deviceUrl;
    /**
     * @instance
     * @type {Object}
     * @readonly
     * @public
     * @memberof Meeting
     */
    // TODO: needs to be defined as a class
    this.meetingInfo = {};
    /**
     * @instance
     * @type {Breakouts}
     * @public
     * @memberof Meeting
     */
    // @ts-ignore
    this.breakouts = new Breakouts({meetingId: this.id}, {parent: this.webex});
    /**
     * @instance
     * @type {SimultaneousInterpretation}
     * @public
     * @memberof Meeting
     */
    // @ts-ignore
    this.simultaneousInterpretation = new SimultaneousInterpretation({}, {parent: this.webex});
    /**
     * @instance
     * @type {Annotation}
     * @public
     * @memberof Meeting
     */
    // @ts-ignore
    this.annotation = new Annotation({parent: this.webex});
    /**
     * helper class for managing receive slots (for multistream media connections)
     */
    this.receiveSlotManager = new ReceiveSlotManager(
      (mediaType: MediaType) => {
        if (!this.mediaProperties?.webrtcMediaConnection) {
          return Promise.reject(new Error('Webrtc media connection is missing'));
        }

        return this.mediaProperties.webrtcMediaConnection.createReceiveSlot(mediaType);
      },
      (csi: CSI) => (this.members.findMemberByCsi(csi) as any)?.id
    );
    /**
     * Object containing helper classes for managing media requests for audio/video/screenshare (for multistream media connections)
     * All multistream media requests sent out for this meeting have to go through them.
     */
    this.mediaRequestManagers = {
      audio: new MediaRequestManager(
        (mediaRequests) => {
          if (!this.mediaProperties.webrtcMediaConnection) {
            LoggerProxy.logger.warn(
              'Meeting:index#mediaRequestManager --> trying to send audio media request before media connection was created'
            );

            return;
          }
          this.mediaProperties.webrtcMediaConnection.requestMedia(
            MediaType.AudioMain,
            mediaRequests
          );
        },
        {
          // @ts-ignore - config coming from registerPlugin
          degradationPreferences: this.config.degradationPreferences,
          kind: 'audio',
          trimRequestsToNumOfSources: false,
        }
      ),
      video: new MediaRequestManager(
        (mediaRequests) => {
          if (!this.mediaProperties.webrtcMediaConnection) {
            LoggerProxy.logger.warn(
              'Meeting:index#mediaRequestManager --> trying to send video media request before media connection was created'
            );

            return;
          }
          this.mediaProperties.webrtcMediaConnection.requestMedia(
            MediaType.VideoMain,
            mediaRequests
          );
        },
        {
          // @ts-ignore - config coming from registerPlugin
          degradationPreferences: this.config.degradationPreferences,
          kind: 'video',
          trimRequestsToNumOfSources: true,
        }
      ),
      screenShareAudio: new MediaRequestManager(
        (mediaRequests) => {
          if (!this.mediaProperties.webrtcMediaConnection) {
            LoggerProxy.logger.warn(
              'Meeting:index#mediaRequestManager --> trying to send screenshare audio media request before media connection was created'
            );

            return;
          }
          this.mediaProperties.webrtcMediaConnection.requestMedia(
            MediaType.AudioSlides,
            mediaRequests
          );
        },
        {
          // @ts-ignore - config coming from registerPlugin
          degradationPreferences: this.config.degradationPreferences,
          kind: 'audio',
          trimRequestsToNumOfSources: false,
        }
      ),
      screenShareVideo: new MediaRequestManager(
        (mediaRequests) => {
          if (!this.mediaProperties.webrtcMediaConnection) {
            LoggerProxy.logger.warn(
              'Meeting:index#mediaRequestManager --> trying to send screenshare video media request before media connection was created'
            );

            return;
          }
          this.mediaProperties.webrtcMediaConnection.requestMedia(
            MediaType.VideoSlides,
            mediaRequests
          );
        },
        {
          // @ts-ignore - config coming from registerPlugin
          degradationPreferences: this.config.degradationPreferences,
          kind: 'video',
          trimRequestsToNumOfSources: false,
        }
      ),
    };
    /**
     * @instance
     * @type {Members}
     * @public
     * @memberof Meeting
     */
    this.members = new Members(
      {
        locusUrl: attrs.locus && attrs.locus.url,
        receiveSlotManager: this.receiveSlotManager,
        mediaRequestManagers: this.mediaRequestManagers,
        meeting: this,
      },
      // @ts-ignore - Fix type
      {parent: this.webex}
    );
    /**
     * @instance
     * @type {Roap}
     * @readonly
     * @private
     * @memberof Meeting
     */
    // @ts-ignore - Fix type
    this.roap = new Roap({}, {parent: this.webex});
    /**
     * indicates if an SDP exchange is happening
     *
     * @instance
     * @type {Boolean}
     * @readonly
     * @private
     * @memberof Meeting
     */
    this.isRoapInProgress = false;
    /**
     * created later
     * @instance
     * @type {ReconnectionManager}
     * @readonly
     * @private
     * @memberof Meeting
     */
    this.reconnectionManager = new ReconnectionManager(this);
    /**
     * created with media connection
     * @instance
     * @type {MuteState}
     * @private
     * @memberof Meeting
     */
    this.audio = null;
    /**
     * created with media connection
     * @instance
     * @type {MuteState}
     * @private
     * @memberof Meeting
     */
    this.video = null;
    /**
     * @instance
     * @type {MeetingStateMachine}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.meetingFiniteStateMachine = MeetingStateMachine.create(this);
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.conversationUrl = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.locusUrl = (attrs.locus && attrs.locus.url) || null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.sipUri = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.destination = attrs.destination;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.destinationType = attrs.destinationType;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.partner = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.type = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.owner = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.hostId = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.policy = null;
    /**
     * @instance
     * @type {MeetingRequest}
     * @private
     * @memberof Meeting
     */
    this.meetingRequest = new MeetingRequest(
      {
        meeting: this,
      },
      options
    );
    /**
     * @instance
     * @type {Array}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.mediaConnections = null;

    /**
     * If true, then media is sent over multiple separate streams.
     * If false, then media is transcoded by the server into a single stream.
     */
    this.isMultistream = false;
    /**
     * Fetching meeting info can be done randomly 2-5 mins before meeting start
     * In case it is done before the timer expires, this timeout id is reset to cancel the timer.
     * @instance
     * @type {Number}
     * @readonly
     * @private
     * @memberof Meeting
     */
    this.fetchMeetingInfoTimeoutId = null;

    /**
     * Update the MediaConnections property with new information
     * @param {array} mediaConnections
     * @returns {undefined}
     * @private
     * @memberof Meeting
     */
    this.updateMediaConnections = (mediaConnections: any[]) => {
      if (!isEqual(this.mediaConnections, mediaConnections)) {
        // grab last/latest item in the new mediaConnections information
        this.mediaConnections = mediaConnections.slice(-1);
      }
    };
    /**
     * Passing only info as we send basic info for meeting added event
     * @instance
     * @type {MediaProperties}
     * @public
     * @memberof Meeting
     */
    this.mediaProperties = new MediaProperties();
    /**
     * @instance
     * @type {InMeetingActions}
     * @public
     * @memberof Meeting
     */
    this.inMeetingActions = new InMeetingActions();
    /**
     * @instance
     * @type {string}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.shareStatus = SHARE_STATUS.NO_SHARE;
    /**
     * @instance
     * @type {ScreenShareFloorStatus}
     * @private
     * @memberof
     */
    this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;
    /**
     * @instance
     * @type {Array}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.callEvents = [];
    /**
     * There is a pending floor requested by the user
     * @instance
     * @type {boolean}
     * @private
     * @memberof Meeting
     */
    this.floorGrantPending = false;
    /**
     * The latest status of the dial in device (can be "JOINED", "CONNECTED", "LEFT",
     * "TRANSFERRING", "SUCCESS" or "")
     * @instance
     * @type {String}
     * @private
     * @memberof Meeting
     */
    this.dialInDeviceStatus = PSTN_STATUS.UNKNOWN;
    /**
     * the url for provisioned device used to dial in
     * @instance
     * @type {String}
     * @private
     * @memberof Meeting
     */
    this.dialInUrl = '';
    /**
     * The latest status of the dial out device (can be "JOINED", "CONNECTED", "LEFT",
     * "TRANSFERRING", "SUCCESS" or "")
     * @instance
     * @type {String}
     * @private
     * @memberof Meeting
     */
    this.dialOutDeviceStatus = PSTN_STATUS.UNKNOWN;
    /**
     * the url for provisioned device used to dial out
     * @instance
     * @type {String}
     * @private
     * @memberof Meeting
     */
    this.dialOutUrl = '';
    /**
     * @instance
     * @type {StatsAnalyzer}
     * @private
     * @memberof Meeting
     */
    this.statsAnalyzer = null;
    /**
     * @instance
     * @type {NetworkQualityMonitor}
     * @private
     * @memberof Meeting
     */
    this.networkQualityMonitor = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.networkStatus = null;
    /**
     * Passing only info as we send basic info for meeting added event
     * @instance
     * @type {MeetingRequest}
     * @private
     * @memberof Meeting
     */
    // @ts-ignore - Fix type
    this.locusInfo = new LocusInfo(this.updateMeetingObject.bind(this), this.webex, this.id);

    // We had to add listeners first before setting up the locus instance
    /**
     * @instance
     * @type {Recording}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.recording = null;

    /**
     * Promise that exists if joining, and resolves upon method completion.
     * @instance
     * @type {Promise}
     * @private
     * @memberof Meeting
     */
    this.deferJoin = undefined;

    /**
     * Staus of websocket connection/mercury connection.
     * @instance
     * @type {Boolean}
     * @private
     * @memberof Meeting
     */
    // @ts-ignore - Fix type
    this.hasWebsocketConnected = this.webex.internal.mercury.connected;

    /**
     * Last sent render information
     * @instance
     * @type {Object}
     * @private
     * @memberof Meeting
     */
    this.lastVideoLayoutInfo = {layoutType: undefined, main: undefined, content: undefined};

    /**
     * Queue of pending media updates requested by the app
     * @instance
     * @type {Array}
     * @private
     * @memberof Meeting
     */
    this.queuedMediaUpdates = [];

    /**
     * Meeting transcription object
     * @instance
     * @type {Transcription}
     * @private
     * @memberof Meeting
     */
    this.transcription = undefined;

    /**
     * Password status. If it's PASSWORD_STATUS.REQUIRED then verifyPassword() needs to be called
     * with the correct password before calling join()
     * @instance
     * @type {PASSWORD_STATUS}
     * @public
     * @memberof Meeting
     */
    this.passwordStatus = PASSWORD_STATUS.UNKNOWN;

    /**
     * Information about required captcha. If null, then no captcha is required. status. If it's PASSWORD_STATUS.REQUIRED then verifyPassword() needs to be called
     * with the correct password before calling join()
     * @instance
     * @type {Object}
     * @property {string} captchaId captcha id
     * @property {string} verificationImageURL Url of the captcha image
     * @property {string} verificationAudioURL Url of the captcha audio file
     * @property {string} refreshURL Url used for refreshing the captcha (don't use it directly, call refreshCaptcha() instead)
     * @public
     * @memberof Meeting
     */
    this.requiredCaptcha = null;

    /**
     * Indicates the reason for last failure to obtain meeting.meetingInfo. MEETING_INFO_FAILURE_REASON.NONE if meeting info was
     * retrieved successfully
     * @instance
     * @type {MEETING_INFO_FAILURE_REASON}
     * @private
     * @memberof Meeting
     */
    this.meetingInfoFailureReason = undefined;

    /**
     * The numeric code, if any, associated with the last failure to obtain the meeting info
     * @instance
     * @type {number}
     * @private
     * @memberof Meeting
     */
    this.meetingInfoFailureCode = undefined;

    /**
     * Repeating timer used to send keepAlives when in lobby
     * @instance
     * @type {String}
     * @private
     * @memberof Meeting
     */
    this.keepAliveTimerId = null;

    /**
     * The class that helps to control recording functions: start, stop, pause, resume, etc
     * @instance
     * @type {RecordingController}
     * @public
     * @memberof Meeting
     */
    this.recordingController = new RecordingController(this.meetingRequest, {
      serviceUrl: this.locusInfo?.links?.services?.record?.url,
      sessionId: this.locusInfo?.fullState?.sessionId,
      locusUrl: this.locusInfo?.url,
      displayHints: [],
    });

    /**
     * The class that helps to control recording functions: start, stop, pause, resume, etc
     * @instance
     * @type {ControlsOptionsManager}
     * @public
     * @memberof Meeting
     */
    this.controlsOptionsManager = new ControlsOptionsManager(this.meetingRequest, {
      locusUrl: this.locusInfo?.url,
      displayHints: [],
    });

    this.setUpLocusInfoListeners();
    this.locusInfo.init(attrs.locus ? attrs.locus : {});
    this.hasJoinedOnce = false;

    /**
     * helper class for managing remote streams
     */
    this.remoteMediaManager = null;

    this.localAudioTrackMuteStateHandler = (event) => {
      this.audio.handleLocalTrackMuteStateChange(this, event.trackState.muted);
    };

    this.localVideoTrackMuteStateHandler = (event) => {
      this.video.handleLocalTrackMuteStateChange(this, event.trackState.muted);
    };

    // The handling of underlying track changes should be done inside
    // @webex/internal-media-core, but for now we have to do it here, because
    // RoapMediaConnection has to use raw MediaStreamTracks in its API until
    // the Calling SDK also moves to using webrtc-core tracks
    this.underlyingLocalTrackChangeHandler = () => {
      if (!this.isMultistream) {
        this.updateTranscodedMediaConnection();
      }
    };
  }

  /**
   * Temporary func to return webex object,
   * in order to access internal plugin metrics
   * in the utils file.
   * @internal
   * @returns {object} webex object
   */
  getWebexObject() {
    // @ts-ignore
    return this.webex;
  }

  /**
   * returns meeting is joined
   * @private
   * @memberof Meeting
   * @returns {Boolean}
   */
  private isJoined() {
    return this.joinedWith?.state === 'JOINED';
  }

  /**
   * Returns whether this meeting is a Locus CALL
   * @returns {Boolean}
   */
  isLocusCall() {
    return this.type === 'CALL';
  }

  /**
   * Fetches meeting information.
   * @param {Object} options
   * @param {String} [options.password] optional
   * @param {String} [options.captchaCode] optional
   * @public
   * @memberof Meeting
   * @returns {Promise}
   */
  public async fetchMeetingInfo({
    password = null,
    captchaCode = null,
    extraParams = {},
  }: {
    password?: string;
    captchaCode?: string;
    extraParams?: Record<string, any>;
  }) {
    // when fetch meeting info is called directly by the client, we want to clear out the random timer for sdk to do it
    if (this.fetchMeetingInfoTimeoutId) {
      clearTimeout(this.fetchMeetingInfoTimeoutId);
      this.fetchMeetingInfoTimeoutId = undefined;
    }
    if (captchaCode && !this.requiredCaptcha) {
      return Promise.reject(
        new Error('fetchMeetingInfo() called with captchaCode when captcha was not required')
      );
    }
    if (
      password &&
      this.passwordStatus !== PASSWORD_STATUS.REQUIRED &&
      this.passwordStatus !== PASSWORD_STATUS.UNKNOWN
    ) {
      return Promise.reject(
        new Error('fetchMeetingInfo() called with password when password was not required')
      );
    }

    try {
      const captchaInfo = captchaCode
        ? {code: captchaCode, id: this.requiredCaptcha.captchaId}
        : null;

      const info = await this.attrs.meetingInfoProvider.fetchMeetingInfo(
        this.destination,
        this.destinationType,
        password,
        captchaInfo,
        // @ts-ignore - config coming from registerPlugin
        this.config.installedOrgID,
        this.locusId,
        extraParams,
        {meetingId: this.id}
      );

      this.parseMeetingInfo(info, this.destination);
      this.meetingInfo = info ? {...info.body, meetingLookupUrl: info?.url} : null;
      this.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.NONE;
      this.requiredCaptcha = null;
      if (
        this.passwordStatus === PASSWORD_STATUS.REQUIRED ||
        this.passwordStatus === PASSWORD_STATUS.VERIFIED
      ) {
        this.passwordStatus = PASSWORD_STATUS.VERIFIED;
      } else {
        this.passwordStatus = PASSWORD_STATUS.NOT_REQUIRED;
      }

      Trigger.trigger(
        this,
        {
          file: 'meetings',
          function: 'fetchMeetingInfo',
        },
        EVENT_TRIGGERS.MEETING_INFO_AVAILABLE
      );

      return Promise.resolve();
    } catch (err) {
      if (err instanceof MeetingInfoV2PolicyError) {
        this.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.POLICY;
        this.meetingInfoFailureCode = err.wbxAppApiCode;

        if (err.meetingInfo) {
          this.meetingInfo = err.meetingInfo;
        }

        throw new PermissionError();
      } else if (err instanceof MeetingInfoV2PasswordError) {
        LoggerProxy.logger.info(
          // @ts-ignore
          `Meeting:index#fetchMeetingInfo --> Info Unable to fetch meeting info for ${this.destination} - password required (code=${err?.body?.code}).`
        );

        // when wbxappapi requires password it still populates partial meeting info in the response
        if (err.meetingInfo) {
          this.meetingInfo = err.meetingInfo;
          this.meetingNumber = err.meetingInfo.meetingNumber;
        }

        this.meetingInfoFailureCode = err.wbxAppApiCode;

        this.passwordStatus = PASSWORD_STATUS.REQUIRED;
        this.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD;
        if (this.requiredCaptcha) {
          // this is a workaround for captcha service bug, see WEBEX-224862
          await this.refreshCaptcha();
        }

        throw new PasswordError();
      } else if (err instanceof MeetingInfoV2CaptchaError) {
        LoggerProxy.logger.info(
          // @ts-ignore
          `Meeting:index#fetchMeetingInfo --> Info Unable to fetch meeting info for ${this.destination} - captcha required (code=${err?.body?.code}).`
        );

        this.meetingInfoFailureReason = this.requiredCaptcha
          ? MEETING_INFO_FAILURE_REASON.WRONG_CAPTCHA
          : MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD;

        this.meetingInfoFailureCode = err.wbxAppApiCode;

        if (err.isPasswordRequired) {
          this.passwordStatus = PASSWORD_STATUS.REQUIRED;
        }

        this.requiredCaptcha = err.captchaInfo;
        throw new CaptchaError();
      } else {
        this.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.OTHER;
        throw err;
      }
    }
  }

  /**
   * Checks if the supplied password/host key is correct. It returns a promise with information whether the
   * password and captcha code were correct or not.
   * @param {String} password - this can be either a password or a host key, can be undefined if only captcha was required
   * @param {String} captchaCode - can be undefined if captcha was not required by the server
   * @public
   * @memberof Meeting
   * @returns {Promise<{isPasswordValid: boolean, requiredCaptcha: boolean, failureReason: MEETING_INFO_FAILURE_REASON}>}
   */
  public verifyPassword(password: string, captchaCode: string) {
    return this.fetchMeetingInfo({
      password,
      captchaCode,
    })
      .then(() => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.VERIFY_PASSWORD_SUCCESS);

        return {
          isPasswordValid: true,
          requiredCaptcha: null,
          failureReason: MEETING_INFO_FAILURE_REASON.NONE,
        };
      })
      .catch((error) => {
        if (error instanceof PasswordError || error instanceof CaptchaError) {
          return {
            isPasswordValid: this.passwordStatus === PASSWORD_STATUS.VERIFIED,
            requiredCaptcha: this.requiredCaptcha,
            failureReason: this.meetingInfoFailureReason,
          };
        }
        throw error;
      });
  }

  /**
   * Refreshes the captcha. As a result the meeting will have new captcha id, image and audio.
   * If the refresh operation fails, meeting remains with the old captcha properties.
   * @public
   * @memberof Meeting
   * @returns {Promise}
   */
  public refreshCaptcha() {
    if (!this.requiredCaptcha) {
      return Promise.reject(new Error('There is no captcha to refresh'));
    }

    // in order to get fully populated uris for captcha audio and image in response to refresh captcha request
    // we have to pass the wbxappapi hostname as the siteFullName parameter
    const {hostname} = new URL(this.requiredCaptcha.refreshURL);

    return (
      this.meetingRequest
        // @ts-ignore
        .refreshCaptcha({
          captchaRefreshUrl: `${this.requiredCaptcha.refreshURL}&siteFullName=${hostname}`,
          captchaId: this.requiredCaptcha.captchaId,
        })
        .then((response) => {
          this.requiredCaptcha.captchaId = response.body.captchaID;
          this.requiredCaptcha.verificationImageURL = response.body.verificationImageURL;
          this.requiredCaptcha.verificationAudioURL = response.body.verificationAudioURL;
        })
        .catch((error) => {
          LoggerProxy.logger.error(
            `Meeting:index#refreshCaptcha --> Error Unable to refresh captcha for ${this.destination} - ${error}`
          );
          throw error;
        })
    );
  }

  /**
   * Posts metrics event for this meeting. Allows the app to send Call Analyzer events.
   * @param {String} eventName - Call Analyzer event
   * @public
   * @memberof Meeting
   * @returns {Promise}
   */
  public postMetrics(eventName: ClientEvent['name']) {
    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: eventName,
      options: {
        meetingId: this.id,
      },
    });
  }

  /**
   * Proxy function for all the listener set ups
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusInfoListeners() {
    // meeting update listeners
    this.setUpLocusInfoSelfListener();
    this.setUpLocusInfoMeetingListener();
    this.setUpLocusServicesListener();
    // members update listeners
    this.setUpLocusFullStateListener();
    this.setUpLocusUrlListener();
    this.setUpLocusHostListener();
    this.setUpLocusSelfListener();
    this.setUpLocusParticipantsListener();
    this.setupLocusControlsListener();
    this.setUpLocusMediaSharesListener();
    this.setUpLocusEmbeddedAppsListener();
    this.setUpLocusInfoMeetingInfoListener();
    this.setUpLocusInfoAssignHostListener();
    this.setUpLocusInfoMediaInactiveListener();
    this.setUpBreakoutsListener();
    this.setUpInterpretationListener();
  }

  /**
   * Set up the listeners for breakouts
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  setUpBreakoutsListener() {
    this.breakouts.on(BREAKOUTS.EVENTS.BREAKOUTS_CLOSING, () => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_CLOSING
      );
    });

    this.breakouts.on(BREAKOUTS.EVENTS.MESSAGE, (messageEvent) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_MESSAGE,
        messageEvent
      );
    });

    this.breakouts.on(BREAKOUTS.EVENTS.MEMBERS_UPDATE, () => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
      );
    });

    this.breakouts.on(BREAKOUTS.EVENTS.ASK_RETURN_TO_MAIN, () => {
      if (this.isJoined()) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpBreakoutsListener',
          },
          EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_RETURN_TO_MAIN
        );
      }
    });

    this.breakouts.on(BREAKOUTS.EVENTS.LEAVE_BREAKOUT, () => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_LEAVE
      );
    });

    this.breakouts.on(BREAKOUTS.EVENTS.ASK_FOR_HELP, (helpEvent) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_FOR_HELP,
        helpEvent
      );
    });

    this.breakouts.on(BREAKOUTS.EVENTS.PRE_ASSIGNMENTS_UPDATE, () => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpBreakoutsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_PRE_ASSIGNMENTS_UPDATE
      );
    });
  }

  /**
   * Set up the listeners for interpretation
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpInterpretationListener() {
    this.simultaneousInterpretation.on(INTERPRETATION.EVENTS.SUPPORT_LANGUAGES_UPDATE, () => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpInterpretationListener',
        },
        EVENT_TRIGGERS.MEETING_INTERPRETATION_SUPPORT_LANGUAGES_UPDATE
      );
    });

    this.simultaneousInterpretation.on(
      INTERPRETATION.EVENTS.HANDOFF_REQUESTS_ARRIVED,
      (payload) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpInterpretationListener',
          },
          EVENT_TRIGGERS.MEETING_INTERPRETATION_HANDOFF_REQUESTS_ARRIVED,
          payload
        );
      }
    );
  }

  /**
   * Set up the locus info listener for meetings disconnected due to inactivity
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusInfoMediaInactiveListener() {
    // User gets kicked off the meeting due to inactivity or user did a refresh
    this.locusInfo.on(EVENTS.DISCONNECT_DUE_TO_INACTIVITY, (res) => {
      // https:// jira-eng-gpk2.cisco.com/jira/browse/SPARK-240520
      // TODO: send custom parameter explaining why the inactivity happened
      // refresh , no media or network got dsconnected or something else
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.DISCONNECT_DUE_TO_INACTIVITY, {
        correlation_id: this.correlationId,
        locus_id: this.locusId,
      });

      // Upload logs on media inactivity
      // Normally media should not be inactive
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoMediaInactiveListener',
        },
        EVENTS.REQUEST_UPLOAD_LOGS,
        this
      );

      LoggerProxy.logger.error(
        `Meeting:index#setUpLocusInfoMediaInactiveListener --> Meeting disconnected due to inactivity: ${res.reason}`
      );

      // @ts-ignore - config coming from registerPlugin
      if (this.config.reconnection.autoRejoin) {
        this.reconnect();
      } else {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoMediaInactiveListener',
          },
          EVENT_TRIGGERS.MEETING_SELF_LEFT,
          res.reason
        );
      }
    });
  }

  /**
   * Set up the locus info listener for assign host permissions on a meeting
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusInfoAssignHostListener() {
    this.locusInfo.on(EVENTS.LOCUS_INFO_CAN_ASSIGN_HOST, (payload) => {
      const changed = this.inMeetingActions.set({
        canAssignHost: payload.canAssignHost,
      });

      if (changed) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoAssignHostListener',
          },
          EVENT_TRIGGERS.MEETING_ACTIONS_UPDATE,
          this.inMeetingActions.get()
        );
      }
    });
  }

  /**
   * Set up the internal locus info full state object listener
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusFullStateListener() {
    this.locusInfo.on(LOCUSINFO.EVENTS.FULL_STATE_MEETING_STATE_CHANGE, (payload) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusFullStateListener',
        },
        EVENT_TRIGGERS.MEETING_STATE_CHANGE,
        {
          payload,
        }
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.FULL_STATE_TYPE_UPDATE, (payload) => {
      this.members.locusFullStateTypeUpdate(payload);
    });
  }

  /**
   * sets the network status on meeting object
   * @param {String} networkStatus
   * @private
   * @returns {undefined}
   * @memberof Meeting
   */
  private setNetworkStatus(networkStatus: string) {
    if (networkStatus === NETWORK_STATUS.DISCONNECTED) {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setNetworkStatus',
        },
        EVENT_TRIGGERS.MEETINGS_NETWORK_DISCONNECTED
      );
    } else if (
      networkStatus === NETWORK_STATUS.CONNECTED &&
      this.networkStatus === NETWORK_STATUS.DISCONNECTED
    ) {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setNetworkStatus',
        },
        EVENT_TRIGGERS.MEETINGS_NETWORK_CONNECTED
      );
    }

    this.networkStatus = networkStatus;
  }

  /**
   * Set up the locus info self listener
   * update self value for members and updates the member
   * notifies consumer with members:self:update {activeSelfId endedSelfId}
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusSelfListener() {
    this.locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_SELF, (payload) => {
      this.members.locusSelfUpdate(payload);
      this.pstnUpdate(payload);

      // If user moved to a JOINED state and there is a pending floor grant trigger it
      this.requestScreenShareFloorIfPending();
    });
  }

  /**
   * Notify any changes on the pstn devices
   * @param {Object} payload
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private pstnUpdate(payload: any) {
    if (this.locusInfo.self) {
      const dialInPstnDevice = payload.newSelf?.pstnDevices.find(
        (device) => device.url === this.dialInUrl
      );
      const dialOutPstnDevice = payload.newSelf?.pstnDevices.find(
        (device) => device.url === this.dialOutUrl
      );
      let changed = false;

      if (dialInPstnDevice) {
        const newStatus = dialInPstnDevice.dialingStatus ?? dialInPstnDevice.state;

        if (newStatus !== this.dialInDeviceStatus) {
          this.dialInDeviceStatus = newStatus;
          changed = true;
        }
      }

      if (dialOutPstnDevice) {
        const newStatus = dialOutPstnDevice.dialingStatus ?? dialOutPstnDevice.state;

        if (newStatus !== this.dialOutDeviceStatus) {
          this.dialOutDeviceStatus = newStatus;
          changed = true;
        }
      }

      if (changed) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusSelfListener',
          },
          EVENT_TRIGGERS.MEETING_SELF_PHONE_AUDIO_UPDATE,
          {
            dialIn: {
              status: this.dialInDeviceStatus,
              attendeeId: dialInPstnDevice?.attendeeId,
            },
            dialOut: {
              status: this.dialOutDeviceStatus,
              attendeeId: dialOutPstnDevice?.attendeeId,
              reason: dialOutPstnDevice?.reason,
            },
          }
        );
      }
    }
  }

  /**
   * Set up the locus info host listener
   * update host value for members and updates the member
   * notifies consumer with members:host:update: {activeHostId, endedHostId}
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusHostListener() {
    this.locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_HOST, (payload) => {
      this.members.locusHostUpdate(payload);
    });
  }

  /**
   * Set up the locus info participants update listener
   * update members collection value for members
   * notifies consumer with members:update
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusParticipantsListener() {
    this.locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS, (payload) => {
      this.members.locusParticipantsUpdate(payload);
    });
  }

  /**
   * Set up the locus info recording update listener
   * update recording value for the meeting
   * notifies consumer with:
   *  meeting:recording:started
   *  meeting:recording:stopped
   *  meeting:recording:paused
   *  meeting:recording:resumed
   *
   * Set up the locus info meeeting container listener
   * update meetingContainerUrl value for the meeting
   * notifies consumer with:
   *  meeting:meetingContainer:update
   *
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setupLocusControlsListener() {
    this.locusInfo.on(
      LOCUSINFO.EVENTS.CONTROLS_RECORDING_UPDATED,
      ({state, modifiedBy, lastModified}) => {
        let event;

        switch (state) {
          case RECORDING_STATE.RECORDING:
            event = EVENT_TRIGGERS.MEETING_STARTED_RECORDING;
            break;
          case RECORDING_STATE.IDLE:
            event = EVENT_TRIGGERS.MEETING_STOPPED_RECORDING;
            break;
          case RECORDING_STATE.PAUSED:
            event = EVENT_TRIGGERS.MEETING_PAUSED_RECORDING;
            break;
          case RECORDING_STATE.RESUMED:
            event = EVENT_TRIGGERS.MEETING_RESUMED_RECORDING;
            break;
          default:
            event = null;
            break;
        }

        // `RESUMED` state should be converted to `RECORDING` after triggering the event
        this.recording = {
          state: state === RECORDING_STATE.RESUMED ? RECORDING_STATE.RECORDING : state,
          modifiedBy,
          lastModified,
        };

        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupLocusControlsListener',
          },
          event,
          this.recording
        );
      }
    );

    this.locusInfo.on(
      LOCUSINFO.EVENTS.CONTROLS_MEETING_CONTAINER_UPDATED,
      ({meetingContainerUrl}) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupLocusControlsListener',
          },
          EVENT_TRIGGERS.MEETING_MEETING_CONTAINER_UPDATE,
          {meetingContainerUrl}
        );
      }
    );

    this.locusInfo.on(
      LOCUSINFO.EVENTS.CONTROLS_MEETING_TRANSCRIBE_UPDATED,
      ({caption, transcribing}) => {
        // @ts-ignore - config coming from registerPlugin
        if (transcribing && this.transcription && this.config.receiveTranscription) {
          this.receiveTranscription();
        } else if (!transcribing && this.transcription) {
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'setupLocusControlsListener',
            },
            EVENT_TRIGGERS.MEETING_STOPPED_RECEIVING_TRANSCRIPTION,
            {caption, transcribing}
          );
        }
      }
    );

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_MEETING_BREAKOUT_UPDATED, ({breakout}) => {
      this.breakouts.updateBreakout(breakout);
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setupLocusControlsListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
      );
    });

    this.locusInfo.on(
      LOCUSINFO.EVENTS.CONTROLS_MEETING_INTERPRETATION_UPDATED,
      ({interpretation}) => {
        this.simultaneousInterpretation.updateInterpretation(interpretation);
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupLocusControlsListener',
          },
          EVENT_TRIGGERS.MEETING_INTERPRETATION_UPDATE
        );
      }
    );

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_JOIN_BREAKOUT_FROM_MAIN, ({mainLocusUrl}) => {
      this.meetingRequest.getLocusStatusByUrl(mainLocusUrl).catch((error) => {
        // clear main session cache when attendee join into breakout and forbidden to get locus from main locus url,
        // which means main session is not active for the attendee
        if (error?.statusCode === 403) {
          this.locusInfo.clearMainSessionLocusCache();
        }
      });
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_ENTRY_EXIT_TONE_UPDATED, ({entryExitTone}) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setupLocusControlsListener',
        },
        EVENT_TRIGGERS.MEETING_ENTRY_EXIT_TONE_UPDATE,
        {entryExitTone}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_MUTE_ON_ENTRY_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_MUTE_ON_ENTRY_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_SHARE_CONTROL_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_SHARE_CONTROL_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_DISALLOW_UNMUTE_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_DISALLOW_UNMUTE_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_REACTIONS_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_REACTIONS_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_VIEW_THE_PARTICIPANTS_LIST_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_VIEW_THE_PARTICIPANTS_LIST_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_RAISE_HAND_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_RAISE_HAND_UPDATED,
        {state}
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.CONTROLS_VIDEO_CHANGED, ({state}) => {
      Trigger.trigger(
        this,
        {file: 'meeting/index', function: 'setupLocusControlsListener'},
        EVENT_TRIGGERS.MEETING_CONTROLS_VIDEO_UPDATED,
        {state}
      );
    });
  }

  /**
   * Trigger annotation info update event
   @returns {undefined}
   @param {object} contentShare
   @param {object} previousContentShare
   */
  private triggerAnnotationInfoEvent(contentShare, previousContentShare) {
    if (
      contentShare?.annotation &&
      !isEqual(contentShare?.annotation, previousContentShare?.annotation)
    ) {
      Trigger.trigger(
        // @ts-ignore
        this.webex.meetings,
        {
          file: 'meeting/index',
          function: 'triggerAnnotationInfoEvent',
        },
        EVENT_TRIGGERS.MEETING_UPDATE_ANNOTATION_INFO,
        {
          annotationInfo: contentShare?.annotation,
          meetingId: this.id,
        }
      );
    }
  }

  /**
   * Set up the locus info media shares listener
   * update content and whiteboard sharing id value for members, and updates the member
   * notifies consumer with members:content:update {activeContentSharingId, endedContentSharingId}
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusMediaSharesListener() {
    // Will get triggered on local and remote share
    this.locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_MEDIA_SHARES, async (payload) => {
      const {content: contentShare, whiteboard: whiteboardShare} = payload.current;
      const previousContentShare = payload.previous?.content;
      const previousWhiteboardShare = payload.previous?.whiteboard;

      this.triggerAnnotationInfoEvent(contentShare, previousContentShare);

      if (
        contentShare.beneficiaryId === previousContentShare?.beneficiaryId &&
        contentShare.disposition === previousContentShare?.disposition &&
        whiteboardShare.beneficiaryId === previousWhiteboardShare?.beneficiaryId &&
        whiteboardShare.disposition === previousWhiteboardShare?.disposition &&
        whiteboardShare.resourceUrl === previousWhiteboardShare?.resourceUrl
      ) {
        // nothing changed, so ignore
        // (this happens when we steal presentation from remote)
        return;
      }

      let newShareStatus = this.shareStatus;

      // REMOTE - check if remote started sharing
      if (
        this.selfId !== contentShare.beneficiaryId &&
        contentShare.disposition === FLOOR_ACTION.GRANTED
      ) {
        // CONTENT - sharing content remote
        newShareStatus = SHARE_STATUS.REMOTE_SHARE_ACTIVE;
      }
      // LOCAL - check if we started sharing content
      else if (
        this.selfId === contentShare.beneficiaryId &&
        contentShare.disposition === FLOOR_ACTION.GRANTED
      ) {
        // CONTENT - sharing content local
        newShareStatus = SHARE_STATUS.LOCAL_SHARE_ACTIVE;
      }
      // If we did not hit the cases above, no one is sharng content, so we check if we are sharing whiteboard
      // There is no concept of local/remote share for whiteboard
      // It does not matter who requested to share the whiteboard, everyone gets the same view
      else if (whiteboardShare.disposition === FLOOR_ACTION.GRANTED) {
        // WHITEBOARD - sharing whiteboard
        newShareStatus = SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE;
      }
      // or if content share is either released or null and whiteboard share is either released or null, no one is sharing
      else if (
        ((previousContentShare && contentShare.disposition === FLOOR_ACTION.RELEASED) ||
          contentShare.disposition === null) &&
        ((previousWhiteboardShare && whiteboardShare.disposition === FLOOR_ACTION.RELEASED) ||
          whiteboardShare.disposition === null)
      ) {
        newShareStatus = SHARE_STATUS.NO_SHARE;
      }

      if (newShareStatus !== this.shareStatus) {
        const oldShareStatus = this.shareStatus;

        // update our state before we send out any notifications
        this.shareStatus = newShareStatus;

        // send out "stop" notifications for the old state
        switch (oldShareStatus) {
          case SHARE_STATUS.REMOTE_SHARE_ACTIVE:
            Trigger.trigger(
              this,
              {
                file: 'meetings/index',
                function: 'remoteShare',
              },
              EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE
            );
            break;

          case SHARE_STATUS.LOCAL_SHARE_ACTIVE:
            Trigger.trigger(
              this,
              {
                file: 'meeting/index',
                function: 'localShare',
              },
              EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
              {
                reason: SHARE_STOPPED_REASON.SELF_STOPPED,
              }
            );
            break;

          case SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE:
            Trigger.trigger(
              this,
              {
                file: 'meeting/index',
                function: 'stopWhiteboardShare',
              },
              EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD
            );
            break;

          case SHARE_STATUS.NO_SHARE:
            // nothing to do
            break;

          default:
            break;
        }

        // send "start" notifications for the new state
        switch (newShareStatus) {
          case SHARE_STATUS.REMOTE_SHARE_ACTIVE: {
            const sendStartedSharingRemote = () => {
              Trigger.trigger(
                this,
                {
                  file: 'meetings/index',
                  function: 'remoteShare',
                },
                EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE,
                {
                  memberId: contentShare.beneficiaryId,
                  url: contentShare.url,
                  shareInstanceId: contentShare.shareInstanceId,
                  annotationInfo: contentShare.annotation,
                }
              );
            };

            try {
              // if a remote participant is stealing the presentation from us
              if (
                this.mediaProperties.mediaDirection?.sendShare &&
                oldShareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE
              ) {
                await this.unpublishTracks([
                  this.mediaProperties.shareVideoTrack,
                  this.mediaProperties.shareAudioTrack,
                ]);
              }
            } finally {
              sendStartedSharingRemote();
            }
            break;
          }

          case SHARE_STATUS.LOCAL_SHARE_ACTIVE:
            Trigger.trigger(
              this,
              {
                file: 'meeting/index',
                function: 'share',
              },
              EVENT_TRIGGERS.MEETING_STARTED_SHARING_LOCAL
            );
            // @ts-ignore
            this.webex.internal.newMetrics.submitClientEvent({
              name: 'client.share.floor-granted.local',
              payload: {
                mediaType: 'share',
              },
              options: {meetingId: this.id},
            });
            break;

          case SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE:
            Trigger.trigger(
              this,
              {
                file: 'meeting/index',
                function: 'startWhiteboardShare',
              },
              EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
              {
                resourceUrl: whiteboardShare.resourceUrl,
                memberId: whiteboardShare.beneficiaryId,
              }
            );
            // @ts-ignore
            this.webex.internal.newMetrics.submitClientEvent({
              name: 'client.share.floor-granted.local',
              payload: {
                mediaType: 'whiteboard',
              },
              options: {
                meetingId: this.id,
              },
            });
            break;

          case SHARE_STATUS.NO_SHARE:
            // nothing to do
            break;

          default:
            break;
        }

        this.members.locusMediaSharesUpdate(payload);
      } else if (newShareStatus === SHARE_STATUS.REMOTE_SHARE_ACTIVE) {
        // if we got here, then some remote participant has stolen
        // the presentation from another remote participant
        Trigger.trigger(
          this,
          {
            file: 'meetings/index',
            function: 'remoteShare',
          },
          EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE,
          {
            memberId: contentShare.beneficiaryId,
            url: contentShare.url,
            shareInstanceId: contentShare.shareInstanceId,
            annotationInfo: contentShare.annotation,
          }
        );
        this.members.locusMediaSharesUpdate(payload);
      } else if (newShareStatus === SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE) {
        // if we got here, then some remote participant has stolen
        // the presentation from another remote participant
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'startWhiteboardShare',
          },
          EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
          {
            resourceUrl: whiteboardShare.resourceUrl,
            memberId: whiteboardShare.beneficiaryId,
          }
        );
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.share.floor-granted.local',
          payload: {
            mediaType: 'whiteboard',
          },
          options: {
            meetingId: this.id,
          },
        });
        this.members.locusMediaSharesUpdate(payload);
      }
    });
  }

  /**
   * Set up the locus info url listener
   * update locus_url value for members
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusUrlListener() {
    this.locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_URL, (payload) => {
      this.members.locusUrlUpdate(payload);
      this.breakouts.locusUrlUpdate(payload);
      this.simultaneousInterpretation.locusUrlUpdate(payload);
      this.annotation.locusUrlUpdate(payload);
      this.locusUrl = payload;
      this.locusId = this.locusUrl?.split('/').pop();
      this.recordingController.setLocusUrl(this.locusUrl);
      this.controlsOptionsManager.setLocusUrl(this.locusUrl);
    });
  }

  /**
   * Set up the locus info service link listener
   * update the locusInfo for recording controller
   * does not currently re-emit the event as it's internal only
   * payload is unused
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusServicesListener() {
    this.locusInfo.on(LOCUSINFO.EVENTS.LINKS_SERVICES, (payload) => {
      this.recordingController.setServiceUrl(payload?.services?.record?.url);
      this.recordingController.setSessionId(this.locusInfo?.fullState?.sessionId);
      this.breakouts.breakoutServiceUrlUpdate(payload?.services?.breakout?.url);
      this.annotation.approvalUrlUpdate(payload?.services?.approval?.url);
      this.simultaneousInterpretation.approvalUrlUpdate(payload?.services?.approval?.url);
    });
  }

  /**
   * Set up the locus info meeting info listener
   * @returns {undefined}
   * @private
   * @memberof meeting
   */
  private setUpLocusInfoMeetingInfoListener() {
    this.locusInfo.on(LOCUSINFO.EVENTS.MEETING_LOCKED, (payload) => {
      if (payload) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoMeetingInfoListener',
          },
          EVENT_TRIGGERS.MEETING_LOCKED,
          {
            payload,
          }
        );
      }
    });
    this.locusInfo.on(LOCUSINFO.EVENTS.MEETING_UNLOCKED, (payload) => {
      if (payload) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoMeetingInfoListener',
          },
          EVENT_TRIGGERS.MEETING_UNLOCKED,
          {
            payload,
          }
        );
      }
    });
    this.locusInfo.on(LOCUSINFO.EVENTS.MEETING_INFO_UPDATED, (payload) => {
      if (payload && payload.info) {
        const changed = this.inMeetingActions.set({
          canInviteNewParticipants: MeetingUtil.canInviteNewParticipants(
            payload.info.userDisplayHints
          ),
          canAdmitParticipant: MeetingUtil.canAdmitParticipant(payload.info.userDisplayHints),
          canLock: MeetingUtil.canUserLock(payload.info.userDisplayHints),
          canUnlock: MeetingUtil.canUserUnlock(payload.info.userDisplayHints),
          canShareWhiteBoard: MeetingUtil.canShareWhiteBoard(payload.info.userDisplayHints),
          canSetDisallowUnmute: ControlsOptionsUtil.canSetDisallowUnmute(
            payload.info.userDisplayHints
          ),
          canUnsetDisallowUnmute: ControlsOptionsUtil.canUnsetDisallowUnmute(
            payload.info.userDisplayHints
          ),
          canSetMuteOnEntry: ControlsOptionsUtil.canSetMuteOnEntry(payload.info.userDisplayHints),
          canUnsetMuteOnEntry: ControlsOptionsUtil.canUnsetMuteOnEntry(
            payload.info.userDisplayHints
          ),
          canSetMuted: ControlsOptionsUtil.canSetMuted(payload.info.userDisplayHints),
          canUnsetMuted: ControlsOptionsUtil.canUnsetMuted(payload.info.userDisplayHints),
          canStartRecording: RecordingUtil.canUserStart(
            payload.info.userDisplayHints,
            this.selfUserPolicies
          ),
          canStopRecording: RecordingUtil.canUserStop(
            payload.info.userDisplayHints,
            this.selfUserPolicies
          ),
          canPauseRecording: RecordingUtil.canUserPause(
            payload.info.userDisplayHints,
            this.selfUserPolicies
          ),
          canResumeRecording: RecordingUtil.canUserResume(
            payload.info.userDisplayHints,
            this.selfUserPolicies
          ),
          canRaiseHand: MeetingUtil.canUserRaiseHand(payload.info.userDisplayHints),
          canLowerAllHands: MeetingUtil.canUserLowerAllHands(payload.info.userDisplayHints),
          canLowerSomeoneElsesHand: MeetingUtil.canUserLowerSomeoneElsesHand(
            payload.info.userDisplayHints
          ),
          bothLeaveAndEndMeetingAvailable: MeetingUtil.bothLeaveAndEndMeetingAvailable(
            payload.info.userDisplayHints
          ),
          canEnableClosedCaption: MeetingUtil.canEnableClosedCaption(payload.info.userDisplayHints),
          canStartTranscribing: MeetingUtil.canStartTranscribing(payload.info.userDisplayHints),
          canStopTranscribing: MeetingUtil.canStopTranscribing(payload.info.userDisplayHints),
          isClosedCaptionActive: MeetingUtil.isClosedCaptionActive(payload.info.userDisplayHints),
          isSaveTranscriptsEnabled: MeetingUtil.isSaveTranscriptsEnabled(
            payload.info.userDisplayHints
          ),
          isWebexAssistantActive: MeetingUtil.isWebexAssistantActive(payload.info.userDisplayHints),
          canViewCaptionPanel: MeetingUtil.canViewCaptionPanel(payload.info.userDisplayHints),
          isRealTimeTranslationEnabled: MeetingUtil.isRealTimeTranslationEnabled(
            payload.info.userDisplayHints
          ),
          canSelectSpokenLanguages: MeetingUtil.canSelectSpokenLanguages(
            payload.info.userDisplayHints
          ),
          waitingForOthersToJoin: MeetingUtil.waitingForOthersToJoin(payload.info.userDisplayHints),
          canSendReactions: MeetingUtil.canSendReactions(
            this.inMeetingActions.canSendReactions,
            payload.info.userDisplayHints
          ),
          canManageBreakout: MeetingUtil.canManageBreakout(payload.info.userDisplayHints),
          canBroadcastMessageToBreakout: MeetingUtil.canBroadcastMessageToBreakout(
            payload.info.userDisplayHints,
            this.selfUserPolicies
          ),
          canAdmitLobbyToBreakout: MeetingUtil.canAdmitLobbyToBreakout(
            payload.info.userDisplayHints
          ),
          isBreakoutPreassignmentsEnabled: MeetingUtil.isBreakoutPreassignmentsEnabled(
            payload.info.userDisplayHints
          ),
          canUserAskForHelp: MeetingUtil.canUserAskForHelp(payload.info.userDisplayHints),
          canUserRenameSelfAndObserved: MeetingUtil.canUserRenameSelfAndObserved(
            payload.info.userDisplayHints
          ),
          canUserRenameOthers: MeetingUtil.canUserRenameOthers(payload.info.userDisplayHints),
          canMuteAll: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.MUTE_ALL],
            displayHints: payload.info.userDisplayHints,
          }),
          canUnmuteAll: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.UNMUTE_ALL],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableHardMute: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_HARD_MUTE],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableHardMute: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_HARD_MUTE],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableMuteOnEntry: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableMuteOnEntry: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableReactions: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_REACTIONS],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableReactions: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_REACTIONS],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableReactionDisplayNames: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableReactionDisplayNames: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_SHOW_DISPLAY_NAME],
            displayHints: payload.info.userDisplayHints,
          }),
          canUpdateShareControl: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.SHARE_CONTROL],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableViewTheParticipantsList: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableViewTheParticipantsList: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableRaiseHand: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_RAISE_HAND],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableRaiseHand: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_RAISE_HAND],
            displayHints: payload.info.userDisplayHints,
          }),
          canEnableVideo: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.ENABLE_VIDEO],
            displayHints: payload.info.userDisplayHints,
          }),
          canDisableVideo: ControlsOptionsUtil.hasHints({
            requiredHints: [DISPLAY_HINTS.DISABLE_VIDEO],
            displayHints: payload.info.userDisplayHints,
          }),
          canShareFile:
            ControlsOptionsUtil.hasHints({
              requiredHints: [DISPLAY_HINTS.SHARE_FILE],
              displayHints: payload.info.userDisplayHints,
            }) &&
            ControlsOptionsUtil.hasPolicies({
              requiredPolicies: [SELF_POLICY.SUPPORT_FILE_SHARE],
              policies: this.selfUserPolicies,
            }),
          canTransferFile: ControlsOptionsUtil.hasPolicies({
            requiredPolicies: [SELF_POLICY.SUPPORT_FILE_TRANSFER],
            policies: this.selfUserPolicies,
          }),
          canShareApplication:
            (ControlsOptionsUtil.hasHints({
              requiredHints: [DISPLAY_HINTS.SHARE_APPLICATION],
              displayHints: payload.info.userDisplayHints,
            }) &&
              (ControlsOptionsUtil.hasPolicies({
                requiredPolicies: [SELF_POLICY.SUPPORT_APP_SHARE],
                policies: this.selfUserPolicies,
              }) ||
                // @ts-ignore
                !this.config.experimental.enableUnifiedMeetings)) ||
            this.isLocusCall(),
          canShareCamera:
            ControlsOptionsUtil.hasHints({
              requiredHints: [DISPLAY_HINTS.SHARE_CAMERA],
              displayHints: payload.info.userDisplayHints,
            }) &&
            ControlsOptionsUtil.hasPolicies({
              requiredPolicies: [SELF_POLICY.SUPPORT_CAMERA_SHARE],
              policies: this.selfUserPolicies,
            }),
          canShareDesktop:
            (ControlsOptionsUtil.hasHints({
              requiredHints: [DISPLAY_HINTS.SHARE_DESKTOP],
              displayHints: payload.info.userDisplayHints,
            }) &&
              (ControlsOptionsUtil.hasPolicies({
                requiredPolicies: [SELF_POLICY.SUPPORT_DESKTOP_SHARE],
                policies: this.selfUserPolicies,
              }) ||
                // @ts-ignore
                !this.config.experimental.enableUnifiedMeetings)) ||
            this.isLocusCall(),
          canShareContent:
            ControlsOptionsUtil.hasHints({
              requiredHints: [DISPLAY_HINTS.SHARE_CONTENT],
              displayHints: payload.info.userDisplayHints,
            }) || this.isLocusCall(),
          canAnnotate: ControlsOptionsUtil.hasPolicies({
            requiredPolicies: [SELF_POLICY.SUPPORT_ANNOTATION],
            policies: this.selfUserPolicies,
          }),
        });

        this.recordingController.setDisplayHints(payload.info.userDisplayHints);
        this.recordingController.setUserPolicy(this.selfUserPolicies);
        this.controlsOptionsManager.setDisplayHints(payload.info.userDisplayHints);

        if (changed) {
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoMeetingInfoListener',
            },
            EVENT_TRIGGERS.MEETING_ACTIONS_UPDATE,
            this.inMeetingActions.get()
          );
        }

        this.handleDataChannelUrlChange(payload.info.datachannelUrl);
      }
    });
  }

  /**
   * Handles a data channel URL change
   * @param {String} datachannelUrl
   * @returns {void}
   */

  handleDataChannelUrlChange(datachannelUrl) {
    // @ts-ignore - config coming from registerPlugin
    if (datachannelUrl && this.config.enableAutomaticLLM) {
      // Defer this as updateLLMConnection relies upon this.locusInfo.url which is only set
      // after the MEETING_INFO_UPDATED callback finishes
      defer(() => {
        this.updateLLMConnection();
      });
    }
  }

  /**
   * Set up the locus info embedded apps listener
   * @returns {undefined}
   * @private
   * @memberof meeting
   */
  private setUpLocusEmbeddedAppsListener() {
    this.locusInfo.on(LOCUSINFO.EVENTS.EMBEDDED_APPS_UPDATED, (embeddedApps) => {
      if (embeddedApps) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusEmbeddedAppsListener',
          },
          EVENT_TRIGGERS.MEETING_EMBEDDED_APPS_UPDATE,
          embeddedApps
        );
      }
    });
  }

  /**
   * Internal function to listen to the self object changes
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusInfoSelfListener() {
    this.locusInfo.on(LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUIRED, (payload) => {
      if (this.audio) {
        this.audio.handleServerLocalUnmuteRequired(this);
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoSelfListener',
          },
          EVENT_TRIGGERS.MEETING_SELF_UNMUTED_BY_OTHERS,
          {
            payload,
          }
        );
      }
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED, (payload) => {
      if (payload) {
        if (this.video) {
          payload.muted = payload.muted ?? this.video.isRemotelyMuted();
          payload.unmuteAllowed = payload.unmuteAllowed ?? this.video.isUnmuteAllowed();
          this.video.handleServerRemoteMuteUpdate(this, payload.muted, payload.unmuteAllowed);
        }
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoSelfListener',
          },
          payload.muted
            ? EVENT_TRIGGERS.MEETING_SELF_VIDEO_MUTED_BY_OTHERS
            : EVENT_TRIGGERS.MEETING_SELF_VIDEO_UNMUTED_BY_OTHERS,
          {
            payload,
          }
        );
      }
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED, (payload) => {
      if (payload) {
        if (this.audio) {
          this.audio.handleServerRemoteMuteUpdate(this, payload.muted, payload.unmuteAllowed);
        }
        // with "mute on entry" server will send us remote mute even if we don't have media configured,
        // so if being muted by others, always send the notification,
        // but if being unmuted, only send it if we are also locally unmuted
        if (payload.muted || !this.audio?.isMuted()) {
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoSelfListener',
            },
            payload.muted
              ? EVENT_TRIGGERS.MEETING_SELF_MUTED_BY_OTHERS
              : EVENT_TRIGGERS.MEETING_SELF_UNMUTED_BY_OTHERS,
            {
              payload,
            }
          );
        }
      }
    });
    this.locusInfo.on(LOCUSINFO.EVENTS.LOCAL_UNMUTE_REQUESTED, (payload) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_SELF_REQUESTED_TO_UNMUTE,
        {
          payload,
        }
      );
    });
    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_UNADMITTED_GUEST, (payload) => {
      if (payload) {
        this.startKeepAlive();

        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoSelfListener',
          },
          EVENT_TRIGGERS.MEETING_SELF_LOBBY_WAITING,
          {
            payload,
          }
        );

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.lobby.entered',
          options: {meetingId: this.id},
        });
      }
    });
    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_ADMITTED_GUEST, (payload) => {
      this.stopKeepAlive();

      if (payload) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoSelfListener',
          },
          EVENT_TRIGGERS.MEETING_SELF_GUEST_ADMITTED,
          {
            payload,
          }
        );

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.lobby.exited',
          options: {meetingId: this.id},
        });
      }
    });

    // @ts-ignore - check if MEDIA_INACTIVITY exists
    this.locusInfo.on(LOCUSINFO.EVENTS.MEDIA_INACTIVITY, () => {
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_MEDIA_INACTIVE, {
        correlation_id: this.correlationId,
        locus_id: this.locusId,
      });
      this.reconnect();
    });

    // There is two stats for mute one is the actual media being sent or received
    // The second on is if the audio is muted, we need to tell the statsAnalyzer when
    // the audio is muted or the user is not willing to send media
    this.locusInfo.on(LOCUSINFO.EVENTS.MEDIA_STATUS_CHANGE, (status) => {
      if (this.statsAnalyzer) {
        this.statsAnalyzer.updateMediaStatus({
          actual: status,
          expected: {
            // We need to check what should be the actual direction of media
            sendAudio: this.mediaProperties.mediaDirection?.sendAudio && !this.audio?.isMuted(),
            sendVideo: this.mediaProperties.mediaDirection?.sendVideo && !this.video?.isMuted(),
            sendShare: this.mediaProperties.mediaDirection?.sendShare,
            receiveAudio: this.mediaProperties.mediaDirection?.receiveAudio,
            receiveVideo: this.mediaProperties.mediaDirection?.receiveVideo,
            receiveShare: this.mediaProperties.mediaDirection?.receiveShare,
          },
        });
      }
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_CANNOT_VIEW_PARTICIPANT_LIST_CHANGE, (payload) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_SELF_CANNOT_VIEW_PARTICIPANT_LIST,
        {
          payload,
        }
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_MEETING_BREAKOUTS_CHANGED, (payload) => {
      this.breakouts.updateBreakoutSessions(payload);
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_MEETING_INTERPRETATION_CHANGED, (payload) => {
      this.simultaneousInterpretation.updateSelfInterpretation(payload);
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_INTERPRETATION_UPDATE
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_ROLES_CHANGED, (payload) => {
      const isModeratorOrCohost =
        payload.newRoles?.includes(SELF_ROLES.MODERATOR) ||
        payload.newRoles?.includes(SELF_ROLES.COHOST);
      this.breakouts.updateCanManageBreakouts(isModeratorOrCohost);
      this.simultaneousInterpretation.updateCanManageInterpreters(
        payload.newRoles?.includes(SELF_ROLES.MODERATOR)
      );
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_SELF_ROLES_CHANGED,
        {
          payload,
        }
      );
    });

    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_IS_SHARING_BLOCKED_CHANGE, (payload) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setUpLocusInfoSelfListener',
        },
        EVENT_TRIGGERS.MEETING_SELF_IS_SHARING_BLOCKED,
        {
          payload,
        }
      );
    });
  }

  /**
   * Add LocusInfo nested object listeners (from child to parent)
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setUpLocusInfoMeetingListener() {
    this.locusInfo.on(EVENTS.REMOTE_RESPONSE, (payload) => {
      this.meetingFiniteStateMachine.remote(payload);

      if (payload.remoteDeclined) {
        this.leave({reason: payload.reason})
          .then(() => {
            LoggerProxy.logger.info(
              'Meeting:index#setUpLocusInfoMeetingListener --> REMOTE_RESPONSE. Attempting to leave meeting.'
            );
          })
          .catch((error) => {
            // @ts-ignore
            LoggerProxy.logger.error(
              `Meeting:index#setUpLocusInfoMeetingListener --> REMOTE_RESPONSE. Issue with leave for meeting, meeting still in collection: ${this}, error: ${error}`
            );
          });
      }
    });
    this.locusInfo.on(EVENTS.DESTROY_MEETING, async (payload) => {
      // if self state is NOT left

      // TODO: Handle sharing and wireless sharing when meeting end
      if (this.wirelessShare) {
        if (this.mediaProperties.shareVideoTrack) {
          await this.setLocalShareVideoTrack(undefined);
        }
        if (this.mediaProperties.shareAudioTrack) {
          await this.setLocalShareAudioTrack(undefined);
        }
      }
      // when multiple WEB deviceType join with same user
      // and some of the devices are joined and some are left
      // when your own device is still connected you want to leave and destroy
      // else you want to just destroy
      // this looks odd because when it leaves it should destroy, but we get a
      // leave response and we should destroy it on the next event loop
      // the leave response gets parsed and we decide if we want to destroy the meeting
      // the first time we just leave it, the second time it comes it destroys it from the collection
      if (payload.shouldLeave) {
        // TODO:  We should do cleaning of meeting object if the shouldLeave: false because there might be meeting object which we are not cleaning

        try {
          await this.leave({reason: payload.reason});

          LoggerProxy.logger.warn(
            'Meeting:index#setUpLocusInfoMeetingListener --> DESTROY_MEETING. The meeting has been left, but has not been destroyed, you should see a later event for leave.'
          );
        } catch (error) {
          // @ts-ignore
          LoggerProxy.logger.error(
            `Meeting:index#setUpLocusInfoMeetingListener --> DESTROY_MEETING. Issue with leave for meeting, meeting still in collection: ${this}, error: ${error}`
          );
        }
      } else {
        LoggerProxy.logger.info(
          'Meeting:index#setUpLocusInfoMeetingListener --> MEETING_REMOVED_REASON',
          payload.reason
        );

        MeetingUtil.cleanUp(this);
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setUpLocusInfoMeetingListener',
          },
          EVENTS.DESTROY_MEETING,
          {
            reason: payload.reason,
            meetingId: this.id,
          }
        );
      }
    });
  }

  /**
   * Set meeting values rather than events
   * @param {Object} object
   * @returns {undefined}
   * @private
   * @memberof Meeting
   * // TODO: is this function necessary?
   */
  private updateMeetingObject(object: object) {
    // Validate if these are valid meeting object property
    // TODO: add a check to make sure the value passed in the constructor
    // is not changed by any delta event
    if (object && Object.keys(object).length) {
      Object.keys(object).forEach((key) => {
        this[key] = object[key];
      });
    }
  }

  /**
   * Invite a guest to the call that isn't normally part of this call
   * @param {Object} invitee
   * @param {String} invitee.emailAddress
   * @param {String} invitee.email
   * @param {String} invitee.phoneNumber
   * @param {Boolean} [alertIfActive]
   * @returns {Promise} see #members.addMember
   * @public
   * @memberof Meeting
   */
  public invite(
    invitee: {
      emailAddress: string;
      email: string;
      phoneNumber: string;
    },
    alertIfActive = true
  ) {
    return this.members.addMember(invitee, alertIfActive);
  }

  /**
   * Cancel an outgoing phone call invitation made during a meeting
   * @param {Object} invitee
   * @param {String} invitee.phoneNumber
   * @returns {Promise} see #members.cancelPhoneInvite
   * @public
   * @memberof Meeting
   */
  public cancelPhoneInvite(invitee: {phoneNumber: string}) {
    return this.members.cancelPhoneInvite(invitee);
  }

  /**
   * Admit the guest(s) to the call once they are waiting.
   * If the host/cohost is in a breakout session, the locus url
   * of the session must be provided as the authorizingLocusUrl.
   * Regardless of host/cohost location, the locus Id (lid) in
   * the path should be the locus Id of the main, which means the
   * locus url of the api call must be from the main session.
   * If these loucs urls are not provided, the function will do the check.
   * @param {Array} memberIds
   * @param {Object} sessionLocusUrls: {authorizingLocusUrl, mainLocusUrl}
   * @returns {Promise} see #members.admitMembers
   * @public
   * @memberof Meeting
   */
  public admit(
    memberIds: Array<any>,
    sessionLocusUrls?: {authorizingLocusUrl: string; mainLocusUrl: string}
  ) {
    let locusUrls = sessionLocusUrls;
    if (!locusUrls) {
      const {locusUrl, mainLocusUrl} = this.breakouts;
      if (locusUrl && mainLocusUrl) {
        locusUrls = {authorizingLocusUrl: locusUrl, mainLocusUrl};
      }
    }

    return this.members.admitMembers(memberIds, locusUrls);
  }

  /**
   * Remove the member from the meeting, boot them
   * @param {String} memberId
   * @returns {Promise} see #members.removeMember
   * @public
   * @memberof Meeting
   */
  public remove(memberId: string) {
    return this.members.removeMember(memberId);
  }

  /**
   * Mute another member from the meeting
   * @param {String} memberId
   * @param {Boolean} mute
   * @returns {Promise} see #members.muteMember
   * @public
   * @memberof Meeting
   */
  public mute(memberId: string, mute = true) {
    return this.members.muteMember(memberId, mute);
  }

  /**
   * Transfer the moderator role to another eligible member
   * @param {String} memberId
   * @param {Boolean} moderator
   * @returns {Promise} see #members.transferHostToMember
   * @public
   * @memberof Meeting
   */
  public transfer(memberId: string, moderator = true) {
    return this.members.transferHostToMember(memberId, moderator);
  }

  /**
   * Reference to the Members object
   * @returns {Members}
   * @public
   * @memberof Meeting
   */
  public getMembers() {
    return this.members;
  }

  /**
   * Sets the meeting info on the class instance
   * @param {Object} meetingInfo
   * @param {Object} meetingInfo.body
   * @param {String} meetingInfo.body.conversationUrl
   * @param {String} meetingInfo.body.locusUrl
   * @param {String} meetingInfo.body.sipUri
   * @param {Object} meetingInfo.body.owner
   * @param {Object | String} destination locus object with meeting data or destination string (sip url, meeting link, etc)
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  parseMeetingInfo(
    meetingInfo:
      | {
          body: {
            conversationUrl: string;
            locusUrl: string;
            sipUri: string;
            owner: object;
          };
        }
      | any,
    destination: object | string | null = null
  ) {
    const webexMeetingInfo = meetingInfo?.body;
    // We try to use as much info from Locus meeting object, stored in destination

    let locusMeetingObject;

    if (destination) {
      locusMeetingObject = typeof destination === 'object' ? destination : undefined;
    }

    // MeetingInfo will be undefined for 1:1 calls
    if (
      locusMeetingObject ||
      (webexMeetingInfo && !(meetingInfo?.errors && meetingInfo?.errors.length > 0))
    ) {
      this.conversationUrl =
        locusMeetingObject?.conversationUrl ||
        webexMeetingInfo?.conversationUrl ||
        this.conversationUrl;
      this.locusUrl = locusMeetingObject?.url || webexMeetingInfo?.locusUrl || this.locusUrl;
      // @ts-ignore - config coming from registerPlugin
      this.setSipUri(
        // @ts-ignore
        this.config.experimental.enableUnifiedMeetings
          ? locusMeetingObject?.info.sipUri || webexMeetingInfo?.sipUrl
          : locusMeetingObject?.info.sipUri || webexMeetingInfo?.sipMeetingUri || this.sipUri
      );
      // @ts-ignore - config coming from registerPlugin
      if (this.config.experimental.enableUnifiedMeetings) {
        this.meetingNumber =
          locusMeetingObject?.info.webExMeetingId || webexMeetingInfo?.meetingNumber;
        this.meetingJoinUrl = webexMeetingInfo?.meetingJoinUrl;
      }
      this.owner =
        locusMeetingObject?.info.owner ||
        webexMeetingInfo?.owner ||
        webexMeetingInfo?.hostId ||
        this.owner;
      this.permissionToken = webexMeetingInfo?.permissionToken;
      this.setSelfUserPolicies(this.permissionToken);
      // Need to populate environment when sending CA event
      this.environment = locusMeetingObject?.info.channel || webexMeetingInfo?.channel;
    }
    MeetingUtil.parseInterpretationInfo(this, webexMeetingInfo);
  }

  /**
   * Sets the self user policies based on the contents of the permission token
   * @param {String} permissionToken
   * @returns {void}
   */
  setSelfUserPolicies(permissionToken: string) {
    this.selfUserPolicies = jwt.decode(permissionToken)?.permission?.userPolicies;
  }

  /**
   * Sets the sip uri on the class instance
   * uses meeting info as precedence
   * @param {String} sipUri
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  setSipUri(sipUri: string) {
    // This can be tel no, device id or a sip uri, user Id
    this.sipUri = sipUri;
  }

  /**
   * Set the locus info the class instance
   * @param {Object} locus
   * @param {Array} locus.mediaConnections
   * @param {String} locus.locusUrl
   * @param {String} locus.locusId
   * @param {String} locus.mediaId
   * @param {Object} locus.host
   * @todo change name to genertic parser
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  setLocus(
    locus:
      | {
          mediaConnections: Array<any>;
          locusUrl: string;
          locusId: string;
          mediaId: string;
          host: object;
        }
      | any
  ) {
    const mtgLocus: any = locus.locus || locus;

    // LocusInfo object saves the locus object
    // this.locus = mtgLocus;
    this.mediaConnections = locus.mediaConnections;
    this.locusUrl = locus.locusUrl || locus.url;
    this.locusId = locus.locusId;
    this.selfId = locus.selfId;
    this.mediaId = locus.mediaId;
    this.hostId = mtgLocus.host ? mtgLocus.host.id : this.hostId;
    this.locusInfo.initialSetup(mtgLocus);
  }

  /**
   * Upload logs for the current meeting
   * @param {object} options file name and function name
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public uploadLogs(options: object = {file: 'meeting/index', function: 'uploadLogs'}) {
    Trigger.trigger(this, options, EVENTS.REQUEST_UPLOAD_LOGS, this);
  }

  /**
   * Removes remote audio, video and share tracks from class instance's mediaProperties
   * @returns {undefined}
   */
  unsetRemoteTracks() {
    this.mediaProperties.unsetRemoteTracks();
  }

  /**
   * Removes the remote stream on the class instance and triggers an event
   * to developers
   * @returns {undefined}
   * @public
   * @memberof Meeting
   * @deprecated after v1.89.3
   */
  public closeRemoteStream() {
    LoggerProxy.logger.warn(
      'Meeting:index#closeRemoteStream --> [DEPRECATION WARNING]: closeRemoteStream has been deprecated after v1.89.3'
    );
    this.closeRemoteTracks();
  }

  /**
   * Removes the remote tracks on the class instance and triggers an event
   * to developers
   * @returns {undefined}
   * @memberof Meeting
   */
  closeRemoteTracks() {
    const {remoteAudioTrack, remoteVideoTrack, remoteShare} = this.mediaProperties;

    /**
     * Triggers an event to the developer
     * @param {string} mediaType Type of media that was stopped
     * @returns {void}
     * @inner
     */
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const triggerMediaStoppedEvent = (mediaType: string) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'closeRemoteTracks',
        },
        EVENT_TRIGGERS.MEDIA_STOPPED,
        {
          type: mediaType,
        }
      );
    };

    /**
     * Stops a media track and emits an event
     * @param {MediaStreamTrack} track Media track to stop
     * @param {string} type Media track type
     * @returns {Promise}
     * @inner
     */
    // eslint-disable-next-line arrow-body-style
    const stopTrack = (track: MediaStreamTrack, type: string) => {
      return Media.stopTracks(track).then(() => {
        const isTrackStopped = track && track.readyState === ENDED;
        const isWrongReadyState = track && !isTrackStopped;

        if (isTrackStopped) {
          triggerMediaStoppedEvent(type);
        } else if (isWrongReadyState) {
          LoggerProxy.logger.warn(
            `Meeting:index#closeRemoteTracks --> Error: MediaStreamTrack.readyState is ${track.readyState} for ${type}`
          );
        }
      });
    };

    return Promise.all([
      stopTrack(remoteAudioTrack, EVENT_TYPES.REMOTE_AUDIO),
      stopTrack(remoteVideoTrack, EVENT_TYPES.REMOTE_VIDEO),
      stopTrack(remoteShare, EVENT_TYPES.REMOTE_SHARE),
    ]);
  }

  /**
   * Stores the reference to a new microphone track, sets up the required event listeners
   * on it, cleans up previous track, etc.
   *
   * @param {LocalMicrophoneTrack | null} localTrack local microphone track
   * @returns {Promise<void>}
   */
  private async setLocalAudioTrack(localTrack?: LocalMicrophoneTrack) {
    const oldTrack = this.mediaProperties.audioTrack;

    oldTrack?.off(LocalTrackEvents.Muted, this.localAudioTrackMuteStateHandler);
    oldTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    // we don't update this.mediaProperties.mediaDirection.sendAudio, because we always keep it as true to avoid extra SDP exchanges
    this.mediaProperties.setLocalAudioTrack(localTrack);

    this.audio.handleLocalTrackChange(this);

    localTrack?.on(LocalTrackEvents.Muted, this.localAudioTrackMuteStateHandler);
    localTrack?.on(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    if (!this.isMultistream || !localTrack) {
      // for multistream WCME automatically un-publishes the old track when we publish a new one
      await this.unpublishTrack(oldTrack);
    }
    await this.publishTrack(this.mediaProperties.audioTrack);
  }

  /**
   * Stores the reference to a new camera track, sets up the required event listeners
   * on it, cleans up previous track, etc.
   *
   * @param {LocalCameraTrack | null} localTrack local camera track
   * @returns {Promise<void>}
   */
  private async setLocalVideoTrack(localTrack?: LocalCameraTrack) {
    const oldTrack = this.mediaProperties.videoTrack;

    oldTrack?.off(LocalTrackEvents.Muted, this.localVideoTrackMuteStateHandler);
    oldTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    // we don't update this.mediaProperties.mediaDirection.sendVideo, because we always keep it as true to avoid extra SDP exchanges
    this.mediaProperties.setLocalVideoTrack(localTrack);

    this.video.handleLocalTrackChange(this);

    localTrack?.on(LocalTrackEvents.Muted, this.localVideoTrackMuteStateHandler);
    localTrack?.on(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    if (!this.isMultistream || !localTrack) {
      // for multistream WCME automatically un-publishes the old track when we publish a new one
      await this.unpublishTrack(oldTrack);
    }
    await this.publishTrack(this.mediaProperties.videoTrack);
  }

  /**
   * Stores the reference to a new screen share video track, sets up the required event listeners
   * on it, cleans up previous track, etc.
   *
   * @param {LocalDisplayTrack | undefined} localDisplayTrack local camera track
   * @returns {Promise<void>}
   */
  private async setLocalShareVideoTrack(localDisplayTrack?: LocalDisplayTrack) {
    const oldTrack = this.mediaProperties.shareVideoTrack;

    oldTrack?.off(LocalTrackEvents.Ended, this.handleShareVideoTrackEnded);
    oldTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    this.mediaProperties.setLocalShareVideoTrack(localDisplayTrack);

    localDisplayTrack?.on(LocalTrackEvents.Ended, this.handleShareVideoTrackEnded);
    localDisplayTrack?.on(
      LocalTrackEvents.UnderlyingTrackChange,
      this.underlyingLocalTrackChangeHandler
    );

    this.mediaProperties.mediaDirection.sendShare = this.mediaProperties.hasLocalShareTrack();

    if (!this.isMultistream || !localDisplayTrack) {
      // for multistream WCME automatically un-publishes the old track when we publish a new one
      await this.unpublishTrack(oldTrack);
    }
    await this.publishTrack(this.mediaProperties.shareVideoTrack);
  }

  /**
   * Stores the reference to a new screen share audio track, sets up the required event listeners
   * on it, cleans up previous track, etc.
   *
   * @param {LocalSystemAudioTrack | undefined} localSystemAudioTrack local system audio track
   * @returns {Promise<void>}
   */
  private async setLocalShareAudioTrack(localSystemAudioTrack?: LocalSystemAudioTrack) {
    const oldTrack = this.mediaProperties.shareAudioTrack;

    oldTrack?.off(LocalTrackEvents.Ended, this.handleShareAudioTrackEnded);
    oldTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    this.mediaProperties.setLocalShareAudioTrack(localSystemAudioTrack);

    localSystemAudioTrack?.on(LocalTrackEvents.Ended, this.handleShareAudioTrackEnded);
    localSystemAudioTrack?.on(
      LocalTrackEvents.UnderlyingTrackChange,
      this.underlyingLocalTrackChangeHandler
    );

    this.mediaProperties.mediaDirection.sendShare = this.mediaProperties.hasLocalShareTrack();

    if (!this.isMultistream || !localSystemAudioTrack) {
      await this.unpublishTrack(oldTrack);
    }
    await this.publishTrack(this.mediaProperties.shareAudioTrack);
  }

  /**
   * Removes references to local tracks. This function should be called
   * on cleanup when we leave the meeting etc.
   *
   * @internal
   * @returns {void}
   */
  public cleanupLocalTracks() {
    const {audioTrack, videoTrack, shareVideoTrack, shareAudioTrack} = this.mediaProperties;

    audioTrack?.off(LocalTrackEvents.Muted, this.localAudioTrackMuteStateHandler);
    audioTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    videoTrack?.off(LocalTrackEvents.Muted, this.localVideoTrackMuteStateHandler);
    videoTrack?.off(LocalTrackEvents.UnderlyingTrackChange, this.underlyingLocalTrackChangeHandler);

    shareVideoTrack?.off(LocalTrackEvents.Ended, this.handleShareVideoTrackEnded);
    shareVideoTrack?.off(
      LocalTrackEvents.UnderlyingTrackChange,
      this.underlyingLocalTrackChangeHandler
    );

    shareAudioTrack?.off(LocalTrackEvents.Ended, this.handleShareAudioTrackEnded);
    shareAudioTrack?.off(
      LocalTrackEvents.UnderlyingTrackChange,
      this.underlyingLocalTrackChangeHandler
    );

    this.mediaProperties.setLocalAudioTrack(undefined);
    this.mediaProperties.setLocalVideoTrack(undefined);
    this.mediaProperties.setLocalShareVideoTrack(undefined);
    this.mediaProperties.setLocalShareAudioTrack(undefined);

    this.mediaProperties.mediaDirection.sendAudio = false;
    this.mediaProperties.mediaDirection.sendVideo = false;
    this.mediaProperties.mediaDirection.sendShare = false;

    // WCME doesn't unpublish tracks when multistream connection is closed, so we do it here
    // (we have to do it for transcoded meetings anyway, so we might as well do for multistream too)
    audioTrack?.setPublished(false);
    videoTrack?.setPublished(false);
    shareVideoTrack?.setPublished(false);
    shareAudioTrack?.setPublished(false);
  }

  /**
   * sets up listner for mercury event
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public setMercuryListener() {
    // Client will have a socket manager and handle reconnecting to mercury, when we reconnect to mercury
    // if the meeting has active peer connections, it should try to reconnect.
    // @ts-ignore
    this.webex.internal.mercury.on(ONLINE, () => {
      LoggerProxy.logger.info('Meeting:index#setMercuryListener --> Web socket online');

      // Only send restore event when it was disconnected before and for connected later
      if (!this.hasWebsocketConnected) {
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.mercury.connection.restored',
          options: {meetingId: this.id},
        });
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MERCURY_CONNECTION_RESTORED, {
          correlation_id: this.correlationId,
        });
      }
      this.hasWebsocketConnected = true;
    });

    // @ts-ignore
    this.webex.internal.mercury.on(OFFLINE, () => {
      LoggerProxy.logger.error('Meeting:index#setMercuryListener --> Web socket offline');
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.mercury.connection.lost',
        options: {meetingId: this.id},
      });
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MERCURY_CONNECTION_FAILURE, {
        correlation_id: this.correlationId,
      });
    });
  }

  /**
   * Close the peer connections and remove them from the class.
   * Cleanup any media connection related things.
   *
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public closePeerConnections() {
    this.locusMediaRequest = undefined;

    if (this.mediaProperties.webrtcMediaConnection) {
      if (this.remoteMediaManager) {
        this.remoteMediaManager.stop();
        this.remoteMediaManager = null;
      }

      Object.values(this.mediaRequestManagers).forEach((mediaRequestManager) =>
        mediaRequestManager.reset()
      );

      this.receiveSlotManager.reset();
      this.mediaProperties.webrtcMediaConnection.close();
    }

    this.audio = null;
    this.video = null;

    return Promise.resolve();
  }

  /**
   * Unsets the peer connections on the class
   * warning DO NOT CALL WITHOUT CLOSING PEER CONNECTIONS FIRST
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public unsetPeerConnections() {
    this.mediaProperties.unsetPeerConnection();
    // @ts-ignore - config coming from registerPlugin
    if (this.config.reconnection.detection) {
      // @ts-ignore
      this.webex.internal.mercury.off(ONLINE);
    }
  }

  /**
   * Convenience method to set the correlation id for the Meeting
   * @param {String} id correlation id to set on the class
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setCorrelationId(id: string) {
    this.correlationId = id;
  }

  /**
   * Enqueue request for screenshare floor and set the status to pending
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private enqueueScreenShareFloorRequest() {
    this.screenShareFloorState = ScreenShareFloorStatus.PENDING;

    return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.SHARE_FLOOR_REQUEST);
  }

  /**
   * Mute the audio for a meeting
   * @returns {Promise} resolves the data from muting audio {mute, self} or rejects if there is no audio set
   * @public
   * @memberof Meeting
   */
  public muteAudio() {
    if (!MeetingUtil.isUserInJoinedState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }

    // @ts-ignore
    if (!this.mediaId) {
      // Happens when addMedia and mute are triggered in succession
      return Promise.reject(new NoMediaEstablishedYetError());
    }

    if (!this.audio) {
      return Promise.reject(new ParameterError('no audio control associated to the meeting'));
    }

    // First, stop sending the local audio media
    return logRequest(
      this.audio
        .handleClientRequest(this, true)
        .then(() => {
          MeetingUtil.handleAudioLogging(this.mediaProperties.audioTrack);
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.muted',
            payload: {trigger: 'user-interaction', mediaType: 'audio'},
            options: {meetingId: this.id},
          });
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MUTE_AUDIO_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          });

          throw error;
        }),
      {
        logText: `Meeting:index#muteAudio --> correlationId=${this.correlationId} muting audio`,
      }
    );
  }

  /**
   * Unmute meeting audio
   * @returns {Promise} resolves data from muting audio {mute, self} or rejects if there is no audio set
   * @public
   * @memberof Meeting
   */
  public unmuteAudio() {
    if (!MeetingUtil.isUserInJoinedState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }

    // @ts-ignore
    if (!this.mediaId) {
      // Happens when addMedia and mute are triggered in succession
      return Promise.reject(new NoMediaEstablishedYetError());
    }

    if (!this.audio) {
      return Promise.reject(new ParameterError('no audio control associated to the meeting'));
    }

    // First, send the control to unmute the participant on the server
    return logRequest(
      this.audio
        .handleClientRequest(this, false)
        .then(() => {
          MeetingUtil.handleAudioLogging(this.mediaProperties.audioTrack);
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.unmuted',
            payload: {trigger: 'user-interaction', mediaType: 'audio'},
            options: {meetingId: this.id},
          });
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UNMUTE_AUDIO_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          });

          throw error;
        }),
      {
        logText: `Meeting:index#unmuteAudio --> correlationId=${this.correlationId} unmuting audio`,
      }
    );
  }

  /**
   * Mute the video for a meeting
   * @returns {Promise} resolves data from muting video {mute, self} or rejects if there is no video set
   * @public
   * @memberof Meeting
   */
  public muteVideo() {
    if (!MeetingUtil.isUserInJoinedState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }

    // @ts-ignore
    if (!this.mediaId) {
      // Happens when addMedia and mute are triggered in succession
      return Promise.reject(new NoMediaEstablishedYetError());
    }

    if (!this.video) {
      return Promise.reject(new ParameterError('no video control associated to the meeting'));
    }

    return logRequest(
      this.video
        .handleClientRequest(this, true)
        .then(() => {
          MeetingUtil.handleVideoLogging(this.mediaProperties.videoTrack);
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.muted',
            payload: {trigger: 'user-interaction', mediaType: 'video'},
            options: {meetingId: this.id},
          });
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MUTE_VIDEO_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          });

          throw error;
        }),
      {
        logText: `Meeting:index#muteVideo --> correlationId=${this.correlationId} muting video`,
      }
    );
  }

  /**
   * Unmute meeting video
   * @returns {Promise} resolves data from muting video {mute, self} or rejects if there is no video set
   * @public
   * @memberof Meeting
   */
  public unmuteVideo() {
    if (!MeetingUtil.isUserInJoinedState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }

    // @ts-ignore
    if (!this.mediaId) {
      // Happens when addMedia and mute are triggered in succession
      return Promise.reject(new NoMediaEstablishedYetError());
    }

    if (!this.video) {
      return Promise.reject(new ParameterError('no audio control associated to the meeting'));
    }

    return logRequest(
      this.video
        .handleClientRequest(this, false)
        .then(() => {
          MeetingUtil.handleVideoLogging(this.mediaProperties.videoTrack);
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.unmuted',
            payload: {trigger: 'user-interaction', mediaType: 'video'},
            options: {meetingId: this.id},
          });
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UNMUTE_VIDEO_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          });

          throw error;
        }),
      {
        logText: `Meeting:index#unmuteVideo --> correlationId=${this.correlationId} unmuting video`,
      }
    );
  }

  /**
   * Shorthand function to join AND set up media
   * @param {Object} options - options to join with media
   * @param {JoinOptions} [options.joinOptions] - see #join()
   * @param {AddMediaOptions} [options.mediaOptions] - see #addMedia()
   * @returns {Promise} -- {join: see join(), media: see addMedia()}
   * @public
   * @memberof Meeting
   * @example
   * joinWithMedia({
   *  joinOptions: {resourceId: 'resourceId' },
   *  mediaOptions: {
   *    localTracks: { microphone: microphoneTrack, camera: cameraTrack }
   *   }
   * })
   */
  public joinWithMedia(
    options: {
      joinOptions?: any;
      mediaOptions?: AddMediaOptions;
    } = {}
  ) {
    const {mediaOptions, joinOptions} = options;

    return this.join(joinOptions)
      .then((joinResponse) =>
        this.addMedia(mediaOptions).then((mediaResponse) => ({
          join: joinResponse,
          media: mediaResponse,
        }))
      )
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:index#joinWithMedia --> ', error);

        Metrics.sendBehavioralMetric(
          BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
          {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          },
          {
            type: error.name,
          }
        );

        return Promise.reject(error);
      });
  }

  /**
   * Initiates the reconnection of the media in the meeting
   *
   * @param {object} options
   * @returns {Promise} resolves with {reconnect} or errors with {error}
   * @public
   * @memberof Meeting
   */
  public reconnect(options?: object) {
    LoggerProxy.logger.log(
      `Meeting:index#reconnect --> attempting to reconnect meeting ${this.id}`
    );

    if (!this.reconnectionManager || !this.reconnectionManager.reconnect) {
      return Promise.reject(
        new ParameterError('Cannot reconnect, ReconnectionManager must first be defined.')
      );
    }

    // @ts-ignore - currentMediaStatus coming from SelfUtil
    if (!MeetingUtil.isMediaEstablished(this.currentMediaStatus)) {
      return Promise.reject(
        new ParameterError('Cannot reconnect, Media has not established to reconnect')
      );
    }

    try {
      LoggerProxy.logger.info('Meeting:index#reconnect --> Validating reconnect ability.');
      // @ts-ignore
      this.reconnectionManager.validate();
    } catch (error) {
      // Unable to reconnect this call
      if (error instanceof ReconnectInProgress) {
        LoggerProxy.logger.info(
          'Meeting:index#reconnect --> Unable to reconnect, reconnection in progress.'
        );
      } else {
        LoggerProxy.logger.log('Meeting:index#reconnect --> Unable to reconnect.', error);
      }

      return Promise.resolve();
    }

    Trigger.trigger(
      this,
      {
        file: 'meeting/index',
        function: 'reconnect',
      },
      EVENT_TRIGGERS.MEETING_RECONNECTION_STARTING
    );

    return this.reconnectionManager
      .reconnect(options)
      .then(() => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'reconnect',
          },
          EVENT_TRIGGERS.MEETING_RECONNECTION_SUCCESS
        );
        LoggerProxy.logger.log('Meeting:index#reconnect --> Meeting reconnect success');
      })
      .catch((error) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'reconnect',
          },
          EVENT_TRIGGERS.MEETING_RECONNECTION_FAILURE,
          {
            error: new ReconnectionError('Reconnection failure event', error),
          }
        );

        LoggerProxy.logger.error('Meeting:index#reconnect --> Meeting reconnect failed', error);

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_RECONNECT_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
        });

        this.uploadLogs({
          file: 'meeting/index',
          function: 'reconnect',
        });

        return Promise.reject(new ReconnectionError('Reconnection failure event', error));
      })
      .finally(() => {
        this.reconnectionManager.reset();
      });
  }

  /**
   * Check if the meeting supports the Webex Assistant feature
   * @returns {boolean}
   * @throws TranscriptionNotSupportedError
   */
  isTranscriptionSupported() {
    if (this.locusInfo.controls.transcribe?.transcribing) {
      return true;
    }

    LoggerProxy.logger.error(
      'Meeting:index#isTranscriptionSupported --> Webex Assistant is not supported'
    );

    return false;
  }

  /**
   * Check if the meeting supports the Reactions
   * @returns {boolean}
   */
  isReactionsSupported() {
    if (this.locusInfo?.controls?.reactions.enabled) {
      return true;
    }

    LoggerProxy.logger.error('Meeting:index#isReactionsSupported --> Reactions is not supported');

    return false;
  }

  /**
   * Monitor the Low-Latency Mercury (LLM) web socket connection on `onError` and `onClose` states
   * @private
   * @returns {void}
   */
  private monitorTranscriptionSocketConnection() {
    this.transcription.onCloseSocket((event) => {
      LoggerProxy.logger.info(
        `Meeting:index#onCloseSocket -->
        unable to continue receiving transcription;
        low-latency mercury web socket connection is closed now.
        ${event}`
      );

      this.triggerStopReceivingTranscriptionEvent();
    });

    this.transcription.onErrorSocket((event) => {
      LoggerProxy.logger.error(
        `Meeting:index#onErrorSocket -->
         unable to continue receiving transcription;
         low-latency mercury web socket connection error had occured.
        ${event}`
      );

      this.triggerStopReceivingTranscriptionEvent();

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.RECEIVE_TRANSCRIPTION_FAILURE, {
        correlation_id: this.correlationId,
        reason: 'unexpected error: transcription LLM web socket connection error had occured.',
        event,
      });
    });
  }

  /**
   * Request for a WebSocket Url, open and monitor the WebSocket connection
   * @private
   * @returns {Promise<void>} a promise to open the WebSocket connection
   */
  private async receiveTranscription() {
    LoggerProxy.logger.info(
      `Meeting:index#receiveTranscription -->
      Attempting to generate a web socket url.`
    );

    try {
      const {datachannelUrl} = this.locusInfo.info;
      // @ts-ignore - fix type
      const {
        body: {webSocketUrl},
        // @ts-ignore
      } = await this.request({
        method: HTTP_VERBS.POST,
        uri: datachannelUrl,
        body: {deviceUrl: this.deviceUrl},
      });

      LoggerProxy.logger.info(
        `Meeting:index#receiveTranscription -->
        Generated web socket url succesfully.`
      );

      this.transcription = new Transcription(
        webSocketUrl,
        // @ts-ignore - fix type
        this.webex.sessionId,
        this.members
      );

      LoggerProxy.logger.info(
        `Meeting:index#receiveTranscription -->
        opened LLM web socket connection successfully.`
      );

      if (!this.inMeetingActions.isClosedCaptionActive) {
        LoggerProxy.logger.error(
          `Meeting:index#receiveTranscription --> Transcription cannot be started until a licensed user enables it`
        );
      }

      // retrieve and pass the payload
      this.transcription.subscribe((payload) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'join',
          },
          EVENT_TRIGGERS.MEETING_STARTED_RECEIVING_TRANSCRIPTION,
          payload
        );
      });

      this.monitorTranscriptionSocketConnection();
      // @ts-ignore - fix type
      this.transcription.connect(this.webex.credentials.supertoken.access_token);
    } catch (error) {
      LoggerProxy.logger.error(`Meeting:index#receiveTranscription --> ${error}`);
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.RECEIVE_TRANSCRIPTION_FAILURE, {
        correlation_id: this.correlationId,
        reason: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Callback called when a relay event is received from meeting LLM Connection
   * @param {RelayEvent} e Event object coming from LLM Connection
   * @private
   * @returns {void}
   */
  private processRelayEvent = (e: RelayEvent): void => {
    switch (e.data.relayType) {
      case REACTION_RELAY_TYPES.REACTION:
        if (
          // @ts-ignore - config coming from registerPlugin
          (this.config.receiveReactions || options.receiveReactions) &&
          this.isReactionsSupported()
        ) {
          const {name} = this.members.membersCollection.get(e.data.sender.participantId);
          const processedReaction: ProcessedReaction = {
            reaction: e.data.reaction,
            sender: {
              id: e.data.sender.participantId,
              name,
            },
          };
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'join',
            },
            EVENT_TRIGGERS.MEETING_RECEIVE_REACTIONS,
            processedReaction
          );
        }
        break;
      default:
        break;
    }
  };

  /**
   * stop recieving Transcription by closing
   * the web socket connection properly
   * @returns {void}
   */
  stopReceivingTranscription() {
    if (this.transcription) {
      this.transcription.closeSocket();
    }
  }

  /**
   * triggers an event to notify that the user
   * will not receive any more transcription
   * @private
   * @returns{void}
   */
  private triggerStopReceivingTranscriptionEvent() {
    LoggerProxy.logger.info(`
      Meeting:index#stopReceivingTranscription -->
      closed transcription LLM web socket connection successfully.`);

    Trigger.trigger(
      this,
      {
        file: 'meeting',
        function: 'triggerStopReceivingTranscriptionEvent',
      },
      EVENT_TRIGGERS.MEETING_STOPPED_RECEIVING_TRANSCRIPTION
    );
  }

  /**
   * Specify joining via audio (option: pstn), video, screenshare
   * @param {JoinOptions} options A configurable options object for joining a meeting
   * @returns {Promise} the join response
   * @public
   * @memberof Meeting
   * Scenario A: Joining own claimed personal meeting room
   * Scenario B: Joining other's claimed personal meeting room, do pass pin (if desired to join as host, or nullify), do pass moderator
   * Scenario C: Joining an unclaimed personal meeting room, -do not- pass pin or moderator on first try, -do- pass pin and moderator
   *             if joining as host on second loop, pass pin and pass moderator if joining as guest on second loop
   * Scenario D: Joining any other way (sip, pstn, conversationUrl, link just need to specify resourceId)
   */
  public join(options: any = {}) {
    // @ts-ignore - fix type
    if (!this.webex.meetings.registered) {
      const errorMessage = 'Meeting:index#join --> Device not registered';
      const error = new Error(errorMessage);

      LoggerProxy.logger.error(errorMessage);

      return Promise.reject(error);
    }

    // If a join request is being processed, refer to the deferred promise.
    if (this.deferJoin) {
      return this.deferJoin;
    }

    // Scope-up the resolve/reject methods for handling within join().
    let joinFailed;
    let joinSuccess;

    // Create a deferred promise for a consistent resolve value from utils.
    // This also prevents redundant API calls.
    this.deferJoin = new Promise((resolve, reject) => {
      joinFailed = reject;
      joinSuccess = resolve;
    });

    if (options.correlationId) {
      this.setCorrelationId(options.correlationId);
      LoggerProxy.logger.log(
        `Meeting:index#join --> Using a new correlation id from app ${this.correlationId}`
      );
    }

    if (!this.hasJoinedOnce) {
      this.hasJoinedOnce = true;
    } else if (!options.correlationId) {
      LoggerProxy.logger.log(
        `Meeting:index#join --> Generating a new correlation id for meeting ${this.id}`
      );
      LoggerProxy.logger.log(
        `Meeting:index#join --> Previous correlation id ${this.correlationId}`
      );
      this.setCorrelationId(uuid.v4());
      LoggerProxy.logger.log(`Meeting:index#join --> New correlation id ${this.correlationId}`);
    }

    if (options.rejoin) {
      this.meetingFiniteStateMachine.reset();
    }

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.call.initiated',
      payload: {trigger: 'user-interaction', isRoapCallEnabled: true},
      options: {meetingId: this.id},
    });

    if (!isEmpty(this.meetingInfo)) {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.meetinginfo.request',
        options: {meetingId: this.id},
      });

      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.meetinginfo.response',
        payload: {
          identifiers: {meetingLookupUrl: this.meetingInfo?.meetingLookupUrl},
        },
        options: {meetingId: this.id},
      });
    }

    LoggerProxy.logger.log('Meeting:index#join --> Joining a meeting');

    if (this.meetingFiniteStateMachine.state === MEETING_STATE_MACHINE.STATES.ENDED) {
      this.meetingFiniteStateMachine.reset();
    }
    if (this.meetingFiniteStateMachine.state !== MEETING_STATE_MACHINE.STATES.RINGING) {
      this.meetingFiniteStateMachine.ring(_JOIN_);
    }

    // TODO: does this really need to be here?
    if (options.resourceId && this.destination && options.resourceId === this.destination) {
      this.wirelessShare = true;
    }

    if (options.meetingQuality) {
      if (typeof options.meetingQuality === 'string') {
        if (!QUALITY_LEVELS[options.meetingQuality]) {
          const errorMessage = `Meeting:index#join --> ${options.meetingQuality} not defined`;
          const error = new Error(errorMessage);

          LoggerProxy.logger.error(errorMessage);

          joinFailed(error);
          this.deferJoin = undefined;

          return Promise.reject(error);
        }

        this.mediaProperties.setRemoteQualityLevel(options.meetingQuality);
      }

      if (typeof options.meetingQuality === 'object') {
        if (!QUALITY_LEVELS[options.meetingQuality.remote]) {
          const errorMessage = `Meeting:index#join --> ${options.meetingQuality.remote} not defined`;

          LoggerProxy.logger.error(errorMessage);

          const error = new Error(errorMessage);

          joinFailed(error);
          this.deferJoin = undefined;

          return Promise.reject(new Error(errorMessage));
        }

        if (options.meetingQuality.remote) {
          this.mediaProperties.setRemoteQualityLevel(options.meetingQuality.remote);
        }
      }
    }

    this.isMultistream = !!options.enableMultistream;

    return MeetingUtil.joinMeetingOptions(this, options)
      .then((join) => {
        this.meetingFiniteStateMachine.join();
        LoggerProxy.logger.log('Meeting:index#join --> Success');

        return join;
      })
      .then((join) => {
        joinSuccess(join);
        this.deferJoin = undefined;
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.JOIN_SUCCESS, {
          correlation_id: this.correlationId,
        });

        return join;
      })
      .then(async (join) => {
        // @ts-ignore - config coming from registerPlugin
        if (this.config.enableAutomaticLLM) {
          await this.updateLLMConnection();
        }

        return join;
      })
      .then(async (join) => {
        if (isBrowser) {
          // @ts-ignore - config coming from registerPlugin
          if (this.config.receiveTranscription || options.receiveTranscription) {
            if (this.isTranscriptionSupported()) {
              await this.receiveTranscription();
              LoggerProxy.logger.info('Meeting:index#join --> enabled to recieve transcription!');
            }
          }
        } else {
          LoggerProxy.logger.error(
            'Meeting:index#join --> Receving transcription is not supported on this platform'
          );
        }

        return join;
      })
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);
        LoggerProxy.logger.error('Meeting:index#join --> Failed', error);

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.locus.join.response',
          payload: {
            identifiers: {meetingLookupUrl: this.meetingInfo?.meetingLookupUrl},
          },
          options: {meetingId: this.id, rawError: error, showToUser: true},
        });

        // TODO:  change this to error codes and pre defined dictionary
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.JOIN_FAILURE, {
          correlation_id: this.correlationId,
          reason: error.error?.message,
          stack: error.stack,
        });

        // Upload logs on join Failure
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'join',
          },
          EVENTS.REQUEST_UPLOAD_LOGS,
          this
        );

        joinFailed(error);
        this.deferJoin = undefined;

        return Promise.reject(error);
      });
  }

  /**
   * Connects to low latency mercury and reconnects if the address has changed
   * It will also disconnect if called when the meeting has ended
   * @param {String} datachannelUrl
   * @returns {Promise}
   */
  async updateLLMConnection() {
    // @ts-ignore - Fix type
    const {url, info: {datachannelUrl} = {}} = this.locusInfo;

    const isJoined = this.isJoined();

    // @ts-ignore - Fix type
    if (this.webex.internal.llm.isConnected()) {
      // @ts-ignore - Fix type
      if (url === this.webex.internal.llm.getLocusUrl() && isJoined) {
        return undefined;
      }
      // @ts-ignore - Fix type
      await this.webex.internal.llm.disconnectLLM();
      // @ts-ignore - Fix type
      this.webex.internal.llm.off('event:relay.event', this.processRelayEvent);
    }

    if (!isJoined) {
      return undefined;
    }

    // @ts-ignore - Fix type
    return this.webex.internal.llm
      .registerAndConnect(url, datachannelUrl)
      .then((registerAndConnectResult) => {
        // @ts-ignore - Fix type
        this.webex.internal.llm.off('event:relay.event', this.processRelayEvent);
        // @ts-ignore - Fix type
        this.webex.internal.llm.on('event:relay.event', this.processRelayEvent);
        LoggerProxy.logger.info(
          'Meeting:index#updateLLMConnection --> enabled to receive relay events!'
        );

        return Promise.resolve(registerAndConnectResult);
      });
  }

  /**
   * Use phone for meeting audio
   * @param {String} phoneNumber If provided, it will dial-out using this number. If not provided, dial-in will be used
   * @returns {Promise} Resolves once the dial-in or dial-out request has completed, or rejects if it failed
   * @public
   * @memberof Meeting
   */
  public usePhoneAudio(phoneNumber: string) {
    if (!phoneNumber) {
      return this.dialInPstn();
    }

    return this.dialOutPstn(phoneNumber);
  }

  /**
   * Determines if the given pstnStatus is in a state which implies the phone is provisioned
   * @param {String} pstnStatus
   * @returns {Boolean}
   * @private
   * @memberof Meeting
   */
  private isPhoneProvisioned(pstnStatus: string) {
    return [PSTN_STATUS.JOINED, PSTN_STATUS.CONNECTED, PSTN_STATUS.SUCCESS].includes(pstnStatus);
  }

  /**
   * Enable dial-in for audio
   * @returns {Promise} Resolves once the dial-in request has completed, or rejects if it failed
   * @private
   * @memberof Meeting
   */
  private dialInPstn() {
    if (this.isPhoneProvisioned(this.dialInDeviceStatus)) return Promise.resolve(); // prevent multiple dial in devices from being provisioned

    const {correlationId, locusUrl} = this;

    if (!this.dialInUrl) this.dialInUrl = `dialin:///${uuid.v4()}`;

    return (
      this.meetingRequest
        // @ts-ignore
        .dialIn({
          correlationId,
          dialInUrl: this.dialInUrl,
          locusUrl,
          clientUrl: this.deviceUrl,
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_DIAL_IN_FAILURE, {
            correlation_id: this.correlationId,
            dial_in_url: this.dialInUrl,
            locus_id: locusUrl.split('/').pop(),
            client_url: this.deviceUrl,
            reason: error.error?.message,
            stack: error.stack,
          });

          return Promise.reject(error);
        })
    );
  }

  /**
   * Enable dial-out for audio
   * @param {String} phoneNumber Phone number to dial out to
   * @returns {Promise} Resolves once the dial-out request has completed (it doesn't wait for the user to answer the phone), or rejects if it failed
   * @private
   * @memberof Meeting
   */
  private dialOutPstn(phoneNumber: string) {
    if (this.isPhoneProvisioned(this.dialOutDeviceStatus)) return Promise.resolve(); // prevent multiple dial out devices from being provisioned

    const {correlationId, locusUrl} = this;

    if (!this.dialOutUrl) this.dialOutUrl = `dialout:///${uuid.v4()}`;

    return (
      this.meetingRequest
        // @ts-ignore
        .dialOut({
          correlationId,
          dialOutUrl: this.dialOutUrl,
          phoneNumber,
          locusUrl,
          clientUrl: this.deviceUrl,
        })
        .catch((error) => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_DIAL_OUT_FAILURE, {
            correlation_id: this.correlationId,
            dial_out_url: this.dialOutUrl,
            locus_id: locusUrl.split('/').pop(),
            client_url: this.deviceUrl,
            reason: error.error?.message,
            stack: error.stack,
          });

          return Promise.reject(error);
        })
    );
  }

  /**
   * Disconnect meeting audio via phone.
   * @returns {Promise} Resolves once the phone audio disconnection has completed
   * @public
   * @memberof Meeting
   * @returns {Promise}
   */
  public disconnectPhoneAudio() {
    return Promise.all([
      this.isPhoneProvisioned(this.dialInDeviceStatus)
        ? MeetingUtil.disconnectPhoneAudio(this, this.dialInUrl)
        : Promise.resolve(),
      this.isPhoneProvisioned(this.dialOutDeviceStatus)
        ? MeetingUtil.disconnectPhoneAudio(this, this.dialOutUrl)
        : Promise.resolve(),
    ]);
  }

  /**
   * Moves the call to the specified resourceId
   * @param {String} resourceId
   * @returns {Promise} once the move has been completed
   * @public
   * @memberof Meeting
   */
  public moveTo(resourceId: string) {
    if (!resourceId) {
      throw new ParameterError('Cannot move call without a resourceId.');
    }

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.media.capabilities',
      payload: {
        mediaCapabilities: {
          rx: {
            audio: false,
            share: true,
            share_audio: false,
            video: false,
            whiteboard: false,
          },
          tx: {
            audio: false,
            share: false,
            share_audio: false,
            video: false,
            whiteboard: false,
          },
        },
      },
      options: {meetingId: this.id},
    });

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.call.move-media',
      options: {meetingId: this.id},
    });

    this.locusInfo.once(LOCUSINFO.EVENTS.SELF_OBSERVING, async () => {
      // Clean up the camera , microphone track and re initiate it

      try {
        if (this.screenShareFloorState === ScreenShareFloorStatus.GRANTED) {
          await this.releaseScreenShareFloor();
        }
        const mediaSettings = {
          mediaDirection: {
            sendVideo: false,
            receiveVideo: false,
            sendAudio: false,
            receiveAudio: false,
            sendShare: false,
            receiveShare: true,
          },
        };

        this.cleanupLocalTracks();

        this.mediaProperties.setMediaDirection(mediaSettings.mediaDirection);
        this.mediaProperties.unsetRemoteMedia();

        // when a move to is intiated by the client , Locus delets the existing media node from the server as soon the DX answers the meeting
        // once the DX answers we establish connection back the media server with only receiveShare enabled
        // @ts-ignore - reconnectMedia does not accept any argument
        await this.reconnectionManager.reconnectMedia(mediaSettings).then(() => {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MOVE_TO_SUCCESS);
        });
      } catch (error) {
        LoggerProxy.logger.error('Meeting:index#moveTo --> Failed to moveTo resourceId', error);
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MOVE_TO_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
        });
      }
    });

    LoggerProxy.logger.info(
      'Meeting:index#moveTo --> Initated moved to using resourceId',
      resourceId
    );

    return MeetingUtil.joinMeetingOptions(this, {resourceId, moveToResource: true})
      .then(() => {
        this.meetingFiniteStateMachine.join();
      })
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MOVE_TO_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
        });
        LoggerProxy.logger.error('Meeting:index#moveTo --> Failed to moveTo resourceId', error);

        return Promise.reject(error);
      });
  }

  /**
   * Moves the call from the specified resourceId, back to computer
   * @param {String} resourceId
   * @returns {Promise} once the move has been completed
   * @public
   * @memberof Meeting
   */
  public moveFrom(resourceId: string) {
    // On moveFrom ask the developer to re capture it moveFrom  then updateMedia
    if (!resourceId) {
      throw new ParameterError('Cannot move call without a resourceId.');
    }
    const oldCorrelationId = this.correlationId;

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.call.move-media',
      options: {meetingId: this.id},
    });

    return MeetingUtil.joinMeetingOptions(this)
      .then(() =>
        MeetingUtil.leaveMeeting(this, {
          resourceId,
          correlationId: oldCorrelationId,
          moveMeeting: true,
        }).then(() => {
          this.resourceId = '';
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MOVE_FROM_SUCCESS);
        })
      )
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MOVE_FROM_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
        });
        LoggerProxy.logger.error('Meeting:index#moveTo --> Failed to moveTo resourceId', error);

        return Promise.reject(error);
      });
  }

  /**
   * Handles ROAP_FAILURE event from the webrtc media connection
   *
   * @param {Error} error
   * @returns {void}
   */
  handleRoapFailure = (error) => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const sendBehavioralMetric = (metricName, error, correlationId) => {
      const data = {
        code: error.code,
        correlation_id: correlationId,
        reason: error.message,
        stack: error.stack,
      };
      const metadata = {
        type: error.cause?.name || error.name,
      };

      Metrics.sendBehavioralMetric(metricName, data, metadata);
    };

    if (error instanceof Errors.SdpOfferCreationError) {
      sendBehavioralMetric(BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE, error, this.correlationId);

      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media-engine.local-sdp-generated',
        payload: {
          canProceed: false,
        },
        options: {meetingId: this.id, rawError: error, showToUser: true},
      });
    } else if (
      error instanceof Errors.SdpOfferHandlingError ||
      error instanceof Errors.SdpAnswerHandlingError
    ) {
      sendBehavioralMetric(BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE, error, this.correlationId);

      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media-engine.remote-sdp-received',
        payload: {
          canProceed: false,
        },
        options: {meetingId: this.id, rawError: error, showToUser: true},
      });
    } else if (error instanceof Errors.SdpError) {
      // this covers also the case of Errors.IceGatheringError which extends Errors.SdpError
      sendBehavioralMetric(BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE, error, this.correlationId);

      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media-engine.local-sdp-generated',
        payload: {
          canProceed: false,
        },
        options: {meetingId: this.id, rawError: error, showToUser: true},
      });
    }
  };

  setupMediaConnectionListeners = () => {
    this.mediaProperties.webrtcMediaConnection.on(Event.ROAP_STARTED, () => {
      this.isRoapInProgress = true;
    });

    this.mediaProperties.webrtcMediaConnection.on(Event.ROAP_DONE, () => {
      this.mediaNegotiatedEvent();
      this.isRoapInProgress = false;
      this.processNextQueuedMediaUpdate();
    });

    this.mediaProperties.webrtcMediaConnection.on(Event.ROAP_FAILURE, this.handleRoapFailure);

    this.mediaProperties.webrtcMediaConnection.on(Event.ROAP_MESSAGE_TO_SEND, (event) => {
      const LOG_HEADER = `Meeting:index#setupMediaConnectionListeners.ROAP_MESSAGE_TO_SEND --> correlationId=${this.correlationId}`;

      switch (event.roapMessage.messageType) {
        case 'OK':
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.media-engine.remote-sdp-received',
            options: {meetingId: this.id},
          });

          logRequest(
            this.roap.sendRoapOK({
              seq: event.roapMessage.seq,
              mediaId: this.mediaId,
              correlationId: this.correlationId,
            }),
            {
              logText: `${LOG_HEADER} Roap OK`,
            }
          );
          break;

        case 'OFFER':
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.media-engine.local-sdp-generated',
            options: {meetingId: this.id},
          });

          logRequest(
            this.roap.sendRoapMediaRequest({
              sdp: event.roapMessage.sdp,
              seq: event.roapMessage.seq,
              tieBreaker: event.roapMessage.tieBreaker,
              meeting: this, // or can pass meeting ID
              reconnect: this.reconnectionManager.isReconnectInProgress(),
            }),
            {
              logText: `${LOG_HEADER} Roap Offer`,
            }
          );
          break;

        case 'ANSWER':
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.media-engine.remote-sdp-received',
            options: {meetingId: this.id},
          });

          logRequest(
            this.roap.sendRoapAnswer({
              sdp: event.roapMessage.sdp,
              seq: event.roapMessage.seq,
              mediaId: this.mediaId,
              correlationId: this.correlationId,
            }),
            {
              logText: `${LOG_HEADER} Roap Answer`,
            }
          ).catch((error) => {
            const metricName = BEHAVIORAL_METRICS.ROAP_ANSWER_FAILURE;
            const data = {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
            };
            const metadata = {
              type: error.name,
            };

            Metrics.sendBehavioralMetric(metricName, data, metadata);
          });
          break;

        case 'ERROR':
          if (
            event.roapMessage.errorType === ErrorType.CONFLICT ||
            event.roapMessage.errorType === ErrorType.DOUBLECONFLICT
          ) {
            Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ROAP_GLARE_CONDITION, {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl.split('/').pop(),
              sequence: event.roapMessage.seq,
            });
          }
          logRequest(
            this.roap.sendRoapError({
              seq: event.roapMessage.seq,
              errorType: event.roapMessage.errorType,
              mediaId: this.mediaId,
              correlationId: this.correlationId,
            }),
            {
              logText: `${LOG_HEADER} Roap Error (${event.roapMessage.errorType})`,
            }
          );
          break;

        default:
          LoggerProxy.logger.error(
            `${LOG_HEADER} Unsupported message type: ${event.roapMessage.messageType}`
          );
          break;
      }
    });

    // eslint-disable-next-line no-param-reassign
    this.mediaProperties.webrtcMediaConnection.on(Event.REMOTE_TRACK_ADDED, (event) => {
      LoggerProxy.logger.log(
        `Meeting:index#setupMediaConnectionListeners --> REMOTE_TRACK_ADDED event received for webrtcMediaConnection: ${JSON.stringify(
          event
        )}`
      );

      const mediaTrack = event.track;

      // eslint-disable-next-line @typescript-eslint/no-shadow
      let eventType;

      switch (event.type) {
        case RemoteTrackType.AUDIO:
          eventType = EVENT_TYPES.REMOTE_AUDIO;
          this.mediaProperties.setRemoteAudioTrack(event.track);
          break;
        case RemoteTrackType.VIDEO:
          eventType = EVENT_TYPES.REMOTE_VIDEO;
          this.mediaProperties.setRemoteVideoTrack(event.track);
          break;
        case RemoteTrackType.SCREENSHARE_VIDEO:
          if (event.track) {
            eventType = EVENT_TYPES.REMOTE_SHARE;
            this.mediaProperties.setRemoteShare(event.track);
          }
          break;
        default: {
          LoggerProxy.logger.log(
            'Meeting:index#setupMediaConnectionListeners --> unexpected track'
          );
        }
      }

      if (eventType && mediaTrack) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupRemoteTrackListener:Event.REMOTE_TRACK_ADDED',
          },
          EVENT_TRIGGERS.MEDIA_READY,
          {
            type: eventType,
            stream: MediaUtil.createMediaStream([mediaTrack]),
          }
        );
      }
    });

    this.mediaProperties.webrtcMediaConnection.on(Event.CONNECTION_STATE_CHANGED, (event) => {
      const connectionFailed = () => {
        // we know the media connection failed and browser will not attempt to recover it any more
        // so reset the timer as it's not needed anymore, we want to reconnect immediately
        this.reconnectionManager.resetReconnectionTimer();

        this.reconnect({networkDisconnect: true});
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.ice.end',
          payload: {
            canProceed: false,
            icePhase: 'IN_MEETING',
            errors: [
              // @ts-ignore
              this.webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode(
                CALL_DIAGNOSTIC_CONFIG.ICE_FAILURE_CLIENT_CODE
              ),
            ],
          },
          options: {
            meetingId: this.id,
          },
        });

        this.uploadLogs({
          file: 'peer-connection-manager/index',
          function: 'connectionFailed',
        });

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.CONNECTION_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusId,
        });
      };

      LoggerProxy.logger.info(
        `Meeting:index#setupMediaConnectionListeners --> correlationId=${this.correlationId} connection state changed to ${event.state}`
      );
      switch (event.state) {
        case ConnectionState.Connecting:
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.ice.start',
            options: {
              meetingId: this.id,
            },
          });
          break;
        case ConnectionState.Connected:
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.ice.end',
            options: {
              meetingId: this.id,
            },
          });
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.CONNECTION_SUCCESS, {
            correlation_id: this.correlationId,
            locus_id: this.locusId,
          });
          this.setNetworkStatus(NETWORK_STATUS.CONNECTED);
          this.reconnectionManager.iceReconnected();
          this.statsAnalyzer.startAnalyzer(this.mediaProperties.webrtcMediaConnection);
          break;
        case ConnectionState.Disconnected:
          this.setNetworkStatus(NETWORK_STATUS.DISCONNECTED);
          this.reconnectionManager.waitForIceReconnect().catch(() => {
            LoggerProxy.logger.info(
              'Meeting:index#setupMediaConnectionListeners --> state DISCONNECTED, automatic reconnection timed out.'
            );

            connectionFailed();
          });
          break;
        case ConnectionState.Failed:
          connectionFailed();
          break;
        default:
          break;
      }
    });

    this.mediaProperties.webrtcMediaConnection.on(Event.ACTIVE_SPEAKERS_CHANGED, (msg) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setupMediaConnectionListeners',
        },
        EVENT_TRIGGERS.ACTIVE_SPEAKER_CHANGED,
        {
          seqNum: msg.seqNum,
          memberIds: msg.csis
            // @ts-ignore
            .map((csi) => this.members.findMemberByCsi(csi)?.id)
            .filter((item) => item !== undefined),
        }
      );
    });

    this.mediaProperties.webrtcMediaConnection.on(
      Event.VIDEO_SOURCES_COUNT_CHANGED,
      (numTotalSources, numLiveSources, mediaContent) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupMediaConnectionListeners',
          },
          EVENT_TRIGGERS.REMOTE_VIDEO_SOURCE_COUNT_CHANGED,
          {
            numTotalSources,
            numLiveSources,
            mediaContent,
          }
        );

        if (mediaContent === MediaContent.Main) {
          this.mediaRequestManagers.video.setNumCurrentSources(numTotalSources, numLiveSources);
        }
      }
    );

    this.mediaProperties.webrtcMediaConnection.on(
      Event.AUDIO_SOURCES_COUNT_CHANGED,
      (numTotalSources, numLiveSources, mediaContent) => {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'setupMediaConnectionListeners',
          },
          EVENT_TRIGGERS.REMOTE_AUDIO_SOURCE_COUNT_CHANGED,
          {
            numTotalSources,
            numLiveSources,
            mediaContent,
          }
        );
      }
    );
  };

  /**
   * Registers for all required StatsAnalyzer events
   * @private
   * @returns {void}
   * @memberof Meetings
   */
  setupStatsAnalyzerEventHandlers = () => {
    this.statsAnalyzer.on(StatsAnalyzerEvents.MEDIA_QUALITY, (options) => {
      // TODO:  might have to send the same event to the developer
      // Add ip address info if geo hint is present
      // @ts-ignore fix type
      options.data.intervalMetadata.peerReflexiveIP =
        // @ts-ignore
        this.webex.meetings.geoHintInfo?.clientAddress ||
        options.data.intervalMetadata.peerReflexiveIP ||
        MQA_STATS.DEFAULT_IP;
      // @ts-ignore
      this.webex.internal.newMetrics.submitMQE({
        name: 'client.mediaquality.event',
        options: {
          meetingId: this.id,
          networkType: options.networkType,
        },
        payload: {
          intervals: [options.data],
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.LOCAL_MEDIA_STARTED, (data) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'addMedia',
        },
        EVENT_TRIGGERS.MEETING_MEDIA_LOCAL_STARTED,
        data
      );
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media.tx.start',
        payload: {mediaType: data.type},
        options: {
          meetingId: this.id,
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.LOCAL_MEDIA_STOPPED, (data) => {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media.tx.stop',
        payload: {mediaType: data.type},
        options: {
          meetingId: this.id,
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.REMOTE_MEDIA_STARTED, (data) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'addMedia',
        },
        EVENT_TRIGGERS.MEETING_MEDIA_REMOTE_STARTED,
        data
      );
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media.rx.start',
        payload: {mediaType: data.type},
        options: {
          meetingId: this.id,
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.REMOTE_MEDIA_STOPPED, (data) => {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.media.rx.stop',
        payload: {mediaType: data.type},
        options: {
          meetingId: this.id,
        },
      });
    });
  };

  getMediaConnectionDebugId() {
    return `MC-${this.id.substring(0, 4)}`;
  }

  /**
   * Creates a webrtc media connection and publishes tracks to it
   *
   * @param {Object} turnServerInfo TURN server information
   * @param {BundlePolicy} [bundlePolicy] Bundle policy settings
   * @returns {RoapMediaConnection | MultistreamRoapMediaConnection}
   */
  private async createMediaConnection(turnServerInfo, bundlePolicy?: BundlePolicy) {
    const mc = Media.createMediaConnection(
      this.isMultistream,
      this.getMediaConnectionDebugId(),
      // @ts-ignore
      this.webex,
      this.id,
      {
        mediaProperties: this.mediaProperties,
        remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
        // @ts-ignore - config coming from registerPlugin
        enableRtx: this.config.enableRtx,
        // @ts-ignore - config coming from registerPlugin
        enableExtmap: this.config.enableExtmap,
        turnServerInfo,
        bundlePolicy,
      }
    );

    this.mediaProperties.setMediaPeerConnection(mc);
    this.setupMediaConnectionListeners();

    // publish the tracks
    if (this.mediaProperties.audioTrack) {
      await this.publishTrack(this.mediaProperties.audioTrack);
    }
    if (this.mediaProperties.videoTrack) {
      await this.publishTrack(this.mediaProperties.videoTrack);
    }
    if (this.mediaProperties.shareVideoTrack) {
      await this.publishTrack(this.mediaProperties.shareVideoTrack);
    }
    if (this.isMultistream && this.mediaProperties.shareAudioTrack) {
      await this.publishTrack(this.mediaProperties.shareAudioTrack);
    }

    return mc;
  }

  /**
   * Listens for an event emitted by eventEmitter and emits it from the meeting object
   *
   * @private
   * @param {*} eventEmitter object from which to forward the event
   * @param {*} eventTypeToForward which event type to listen on and to forward
   * @param {string} meetingEventType event type to be used in the event emitted from the meeting object
   * @returns {void}
   */
  forwardEvent(eventEmitter, eventTypeToForward, meetingEventType) {
    eventEmitter.on(eventTypeToForward, (data) =>
      Trigger.trigger(
        this,
        {
          file: 'meetings',
          function: 'addMedia',
        },
        meetingEventType,
        data
      )
    );
  }

  /**
   * Creates a media connection to the server. Media connection is required for sending or receiving any audio/video.
   *
   * @param {AddMediaOptions} options
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  addMedia(options: AddMediaOptions = {}) {
    const LOG_HEADER = 'Meeting:index#addMedia -->';

    let turnDiscoverySkippedReason;
    let turnServerUsed = false;

    LoggerProxy.logger.info(`${LOG_HEADER} called with: ${JSON.stringify(options)}`);

    if (this.meetingState !== FULL_STATE.ACTIVE) {
      return Promise.reject(new MeetingNotActiveError());
    }

    if (MeetingUtil.isUserInLeftState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }

    const {
      localTracks,
      audioEnabled = true,
      videoEnabled = true,
      receiveShare = true,
      remoteMediaManagerConfig,
      bundlePolicy,
      allowMediaInLobby,
    } = options;

    this.allowMediaInLobby = options?.allowMediaInLobby;

    // If the user is unjoined or guest waiting in lobby dont allow the user to addMedia
    // @ts-ignore - isUserUnadmitted coming from SelfUtil
    if (this.isUserUnadmitted && !this.wirelessShare && !allowMediaInLobby) {
      return Promise.reject(new UserInLobbyError());
    }

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.media.capabilities',
      payload: {
        mediaCapabilities: {
          rx: {
            audio: false,
            share: false,
            share_audio: false,
            video: false,
            whiteboard: false,
          },
          tx: {
            audio: false,
            share: false,
            share_audio: false,
            video: false,
            whiteboard: false,
          },
        },
      },
      options: {meetingId: this.id},
    });

    // when audioEnabled/videoEnabled is true, we set sendAudio/sendVideo to true even before any tracks are published
    // to avoid doing an extra SDP exchange when they are published for the first time
    this.mediaProperties.setMediaDirection({
      sendAudio: audioEnabled,
      sendVideo: videoEnabled,
      sendShare: false,
      receiveAudio: audioEnabled,
      receiveVideo: videoEnabled,
      receiveShare,
    });

    this.locusMediaRequest = new LocusMediaRequest(
      {
        correlationId: this.correlationId,
        device: {
          url: this.deviceUrl,
          // @ts-ignore
          deviceType: this.config.deviceType,
        },
        preferTranscoding: !this.isMultistream,
      },
      {
        // @ts-ignore
        parent: this.webex,
      }
    );

    this.audio = createMuteState(AUDIO, this, audioEnabled);
    this.video = createMuteState(VIDEO, this, videoEnabled);

    this.annotationInfo = localTracks?.annotationInfo;

    const promises = [];

    // setup all the references to local tracks in this.mediaProperties before creating media connection
    // and before TURN discovery, so that the correct mute state is sent with TURN discovery roap messages
    if (localTracks?.microphone) {
      promises.push(this.setLocalAudioTrack(localTracks.microphone));
    }
    if (localTracks?.camera) {
      promises.push(this.setLocalVideoTrack(localTracks.camera));
    }
    if (localTracks?.screenShare?.video) {
      promises.push(this.setLocalShareVideoTrack(localTracks.screenShare.video));
    }
    if (this.isMultistream && localTracks?.screenShare?.audio) {
      promises.push(this.setLocalShareAudioTrack(localTracks.screenShare.audio));
    }

    return Promise.all(promises)
      .then(() => this.roap.doTurnDiscovery(this, false))
      .then(async (turnDiscoveryObject) => {
        ({turnDiscoverySkippedReason} = turnDiscoveryObject);
        turnServerUsed = !turnDiscoverySkippedReason;

        const {turnServerInfo} = turnDiscoveryObject;

        const mc = await this.createMediaConnection(turnServerInfo, bundlePolicy);

        if (this.isMultistream) {
          this.remoteMediaManager = new RemoteMediaManager(
            this.receiveSlotManager,
            this.mediaRequestManagers,
            remoteMediaManagerConfig
          );

          this.forwardEvent(
            this.remoteMediaManager,
            RemoteMediaManagerEvent.AudioCreated,
            EVENT_TRIGGERS.REMOTE_MEDIA_AUDIO_CREATED
          );
          this.forwardEvent(
            this.remoteMediaManager,
            RemoteMediaManagerEvent.ScreenShareAudioCreated,
            EVENT_TRIGGERS.REMOTE_MEDIA_SCREEN_SHARE_AUDIO_CREATED
          );
          this.forwardEvent(
            this.remoteMediaManager,
            RemoteMediaManagerEvent.VideoLayoutChanged,
            EVENT_TRIGGERS.REMOTE_MEDIA_VIDEO_LAYOUT_CHANGED
          );

          await this.remoteMediaManager.start();
        }

        await mc.initiateOffer();
      })
      .then(() => {
        this.setMercuryListener();
      })
      .then(
        () =>
          getDevices()
            .then((devices) => {
              MeetingUtil.handleDeviceLogging(devices);
            })
            .catch(() => {}) // getDevices may fail if we don't have browser permissions, that's ok, we still can have a media connection
      )
      .then(() => {
        this.handleMediaLogging(this.mediaProperties);
        LoggerProxy.logger.info(`${LOG_HEADER} media connection created`);

        // @ts-ignore - config coming from registerPlugin
        if (this.config.stats.enableStatsAnalyzer) {
          // @ts-ignore - config coming from registerPlugin
          this.networkQualityMonitor = new NetworkQualityMonitor(this.config.stats);
          this.statsAnalyzer = new StatsAnalyzer(
            // @ts-ignore - config coming from registerPlugin
            this.config.stats,
            (ssrc: number) => this.receiveSlotManager.findReceiveSlotBySsrc(ssrc),
            this.networkQualityMonitor
          );
          this.setupStatsAnalyzerEventHandlers();
          this.networkQualityMonitor.on(
            EVENT_TRIGGERS.NETWORK_QUALITY,
            this.sendNetworkQualityEvent.bind(this)
          );
        }
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `${LOG_HEADER} Error adding media , setting up peerconnection, `,
          error
        );

        throw error;
      })
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            let timerCount = 0;

            // eslint-disable-next-line func-names
            // eslint-disable-next-line prefer-arrow-callback
            if (this.type === _CALL_ || this.meetingState === FULL_STATE.ACTIVE) {
              resolve();
            }
            const joiningTimer = setInterval(() => {
              timerCount += 1;
              if (this.meetingState === FULL_STATE.ACTIVE) {
                clearInterval(joiningTimer);
                resolve();
              }

              if (timerCount === 4) {
                clearInterval(joiningTimer);
                reject(new Error('Meeting is still not active '));
              }
            }, 1000);
          })
      )
      .then(() =>
        this.mediaProperties.waitForMediaConnectionConnected().catch(() => {
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.ice.end',
            payload: {
              canProceed: false,
              icePhase: 'JOIN_MEETING_FINAL',
              errors: [
                // @ts-ignore
                this.webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode(
                  CALL_DIAGNOSTIC_CONFIG.ICE_FAILURE_CLIENT_CODE
                ),
              ],
            },
            options: {
              meetingId: this.id,
            },
          });
          throw new Error(
            `Timed out waiting for media connection to be connected, correlationId=${this.correlationId}`
          );
        })
      )
      .then(() => {
        if (this.mediaProperties.hasLocalShareTrack()) {
          return this.enqueueScreenShareFloorRequest();
        }

        return Promise.resolve();
      })
      .then(() => this.mediaProperties.getCurrentConnectionType())
      .then((connectionType) => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_MEDIA_SUCCESS, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          connectionType,
          isMultistream: this.isMultistream,
        });
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.media-engine.ready',
          options: {
            meetingId: this.id,
          },
        });
      })
      .catch((error) => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
          code: error.code,
          turnDiscoverySkippedReason,
          turnServerUsed,
          isMultistream: this.isMultistream,
          signalingState:
            this.mediaProperties.webrtcMediaConnection?.multistreamConnection?.pc?.pc
              ?.signalingState ||
            this.mediaProperties.webrtcMediaConnection?.mediaConnection?.pc?.signalingState ||
            'unknown',
          connectionState:
            this.mediaProperties.webrtcMediaConnection?.multistreamConnection?.pc?.pc
              ?.connectionState ||
            this.mediaProperties.webrtcMediaConnection?.mediaConnection?.pc?.connectionState ||
            'unknown',
          iceConnectionState:
            this.mediaProperties.webrtcMediaConnection?.multistreamConnection?.pc?.pc
              ?.iceConnectionState ||
            this.mediaProperties.webrtcMediaConnection?.mediaConnection?.pc?.iceConnectionState ||
            'unknown',
        });

        // Clean up stats analyzer, peer connection, and turn off listeners
        const stopStatsAnalyzer = this.statsAnalyzer
          ? this.statsAnalyzer.stopAnalyzer()
          : Promise.resolve();

        return stopStatsAnalyzer.then(() => {
          this.statsAnalyzer = null;

          if (this.mediaProperties.webrtcMediaConnection) {
            this.closePeerConnections();
            this.unsetPeerConnections();
          }

          LoggerProxy.logger.error(
            `${LOG_HEADER} Error adding media failed to initiate PC and send request, `,
            error
          );

          // Upload logs on error while adding media
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'addMedia',
            },
            EVENTS.REQUEST_UPLOAD_LOGS,
            this
          );

          if (error instanceof Errors.SdpError) {
            this.leave({reason: MEETING_REMOVED_REASON.MEETING_CONNECTION_FAILED});
          }

          throw error;
        });
      });
  }

  /**
   * Informs if the peer connection is in a state that can be updated with updateMedia (audio/video/share)
   * @returns {Boolean}
   */
  canUpdateMedia() {
    // in theory we shouldn't need this as RoapMediaConnection handles multiple updates, glare, etc,
    // but there are some server issues, like https://jira-eng-gpk2.cisco.com/jira/browse/WEBEX-248394
    // so for now it's better to keep queuing any media updates at SDK meeting level
    return !this.isRoapInProgress;
  }

  /**
   * Enqueues a media update operation.
   * @param {String} mediaUpdateType one of MEDIA_UPDATE_TYPE values
   * @param {Object} options
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private enqueueMediaUpdate(mediaUpdateType: string, options: any = {}): Promise<void> {
    const canUpdateMediaNow = this.canUpdateMedia();

    return new Promise((resolve, reject) => {
      const queueItem = {
        pendingPromiseResolve: resolve,
        pendingPromiseReject: reject,
        mediaUpdateType,
        options,
      };

      LoggerProxy.logger.log(
        `Meeting:index#enqueueMediaUpdate --> enqueuing media update type=${mediaUpdateType}`
      );
      this.queuedMediaUpdates.push(queueItem);

      if (canUpdateMediaNow) {
        this.processNextQueuedMediaUpdate();
      }
    });
  }

  /**
   * emits event when the negotation is completed
   * @returns {void}
   * @private
   * @memberof Meeting
   */
  mediaNegotiatedEvent = () => {
    // @ts-ignore - config coming from registerPlugin
    if (this.config.experimental.enableMediaNegotiatedEvent) {
      LoggerProxy.logger.info('Meeting:mediaNegotiatedEvent --> Media server negotiated');
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'mediaNegotiatedEvent',
        },
        EVENT_TRIGGERS.MEDIA_NEGOTIATED
      );
    }
  };

  /**
   * Checks if there are any queued media updates and runs the first one from
   * the queue if we are in a state that allows doing that.
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  processNextQueuedMediaUpdate = () => {
    if (this.canUpdateMedia() && this.queuedMediaUpdates.length > 0) {
      const {pendingPromiseResolve, pendingPromiseReject, mediaUpdateType, options} =
        this.queuedMediaUpdates.shift();

      LoggerProxy.logger.log(
        `Meeting:index#processNextQueuedMediaUpdate --> performing delayed media update type=${mediaUpdateType}`
      );
      let mediaUpdate = Promise.resolve();

      switch (mediaUpdateType) {
        case MEDIA_UPDATE_TYPE.TRANSCODED_MEDIA_CONNECTION:
          mediaUpdate = this.updateTranscodedMediaConnection();
          break;
        case MEDIA_UPDATE_TYPE.SHARE_FLOOR_REQUEST:
          mediaUpdate = this.requestScreenShareFloor();
          break;
        case MEDIA_UPDATE_TYPE.UPDATE_MEDIA:
          mediaUpdate = this.updateMedia(options);
          break;
        default:
          LoggerProxy.logger.error(
            `Peer-connection-manager:index#processNextQueuedMediaUpdate --> unsupported media update type ${mediaUpdateType} found in the queue`
          );
          break;
      }

      mediaUpdate
        .then(pendingPromiseResolve, pendingPromiseReject)
        .then(() => this.processNextQueuedMediaUpdate());
    }
  };

  /**
   * Updates the media connection - it allows to enable/disable all audio/video/share in the meeting.
   * This does not affect the published tracks, so for example if a microphone track is published and
   * updateMedia({audioEnabled: false}) is called, the audio will not be sent or received anymore,
   * but the track's "published" state is not changed and when updateMedia({audioEnabled: true}) is called,
   * the sending of the audio from the same track will resume.
   *
   * @param {Object} options
   * @param {boolean} options.audioEnabled [optional] enables/disables receiving and sending of main audio in the meeting
   * @param {boolean} options.videoEnabled [optional] enables/disables receiving and sending of main video in the meeting
   * @param {boolean} options.shareEnabled [optional] enables/disables receiving and sending of screen share in the meeting
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public async updateMedia(options: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    receiveShare?: boolean;
  }) {
    this.checkMediaConnection();

    const {audioEnabled, videoEnabled, receiveShare} = options;

    LoggerProxy.logger.log(
      `Meeting:index#updateMedia --> called with options=${JSON.stringify(options)}`
    );

    if (!this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.UPDATE_MEDIA, options);
    }

    if (this.isMultistream) {
      if (videoEnabled !== undefined) {
        throw new Error(
          'enabling/disabling video in a meeting is not supported for multistream, it can only be done upfront when calling addMedia()'
        );
      }

      if (receiveShare !== undefined) {
        throw new Error(
          'toggling receiveShare in a multistream meeting is not supported, to control receiving screen share call meeting.remoteMediaManager.setLayout() with appropriate layout'
        );
      }
    }

    if (audioEnabled !== undefined) {
      this.mediaProperties.mediaDirection.sendAudio = audioEnabled;
      this.mediaProperties.mediaDirection.receiveAudio = audioEnabled;
      this.audio.enable(this, audioEnabled);
    }

    if (videoEnabled !== undefined) {
      this.mediaProperties.mediaDirection.sendVideo = videoEnabled;
      this.mediaProperties.mediaDirection.receiveVideo = videoEnabled;
      this.video.enable(this, videoEnabled);
    }

    if (receiveShare !== undefined) {
      this.mediaProperties.mediaDirection.receiveShare = receiveShare;
    }

    if (this.isMultistream) {
      if (audioEnabled !== undefined) {
        await this.mediaProperties.webrtcMediaConnection.enableMultistreamAudio(audioEnabled);
      }
    } else {
      await this.updateTranscodedMediaConnection();
    }

    return undefined;
  }

  /**
   * Acknowledge the meeting, outgoing or incoming
   * @param {String} type
   * @returns {Promise} resolve {message, ringing, response}
   * @public
   * @memberof Meeting
   */
  public acknowledge(type: string) {
    if (!type) {
      return Promise.reject(new ParameterError('Type must be set to acknowledge the meeting.'));
    }
    if (type === _INCOMING_) {
      return this.meetingRequest
        .acknowledgeMeeting({
          locusUrl: this.locusUrl,
          deviceUrl: this.deviceUrl,
          correlationId: this.correlationId,
        })
        .then((response) => Promise.resolve(response))
        .then((response) => {
          this.meetingFiniteStateMachine.ring(type);
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.alert.displayed',
            options: {meetingId: this.id},
          });

          return Promise.resolve({
            response,
          });
        });
    }

    // TODO: outside of 1:1 incoming, and all outgoing calls
    return Promise.resolve({
      message: 'noop',
    });
  }

  /**
   * Decline this meeting
   * @param {String} reason
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public decline(reason: string) {
    return MeetingUtil.declineMeeting(this, reason)
      .then((decline) => {
        this.meetingFiniteStateMachine.decline();

        return Promise.resolve(decline);
      })
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);

        return Promise.reject(error);
      });
  }

  /**
   * Leave the current meeting
   * @param {Object} options leave options
   * @param {String} options.resourceId the device with which to leave from, empty if just the computer
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public leave(options: {resourceId?: string; reason?: any} = {} as any) {
    const leaveReason = options.reason || MEETING_REMOVED_REASON.CLIENT_LEAVE_REQUEST;
    /// @ts-ignore
    this.webex.internal.newMetrics.submitInternalEvent({name: 'internal.reset.join.latencies'});

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.call.leave',
      payload: {
        trigger: 'user-interaction',
        canProceed: false,
        leaveReason,
      },
      options: {meetingId: this.id},
    });
    LoggerProxy.logger.log('Meeting:index#leave --> Leaving a meeting');

    return MeetingUtil.leaveMeeting(this, options)
      .then((leave) => {
        this.meetingFiniteStateMachine.leave();
        this.clearMeetingData();

        // upload logs on leave irrespective of meeting delete
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'leave',
          },
          EVENTS.REQUEST_UPLOAD_LOGS,
          this
        );

        // TODO: more testing before we remove this code, we are not sure the scenarios for destroy here
        if (this.wirelessShare || this.guest) {
          // If screen sharing clean the meeting object
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'leave',
            },
            EVENTS.DESTROY_MEETING,
            {
              reason: options.reason,
              meetingId: this.id,
            }
          );
        }
        LoggerProxy.logger.log('Meeting:index#leave --> LEAVE REASON ', leaveReason);

        return leave;
      })
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);
        LoggerProxy.logger.error('Meeting:index#leave --> Failed to leave ', error);
        // upload logs on leave irrespective of meeting delete
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'leave',
          },
          EVENTS.REQUEST_UPLOAD_LOGS,
          this
        );
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_LEAVE_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
          code: error.code,
        });

        return Promise.reject(error);
      });
  }

  /**
   * Start sharing whiteboard given channelUrl
   * @param {string} channelUrl whiteboard url
   * @param {String} resourceToken token created by authorize media injector
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public startWhiteboardShare(channelUrl: string, resourceToken: string) {
    const whiteboard = this.locusInfo.mediaShares.find((element) => element.name === 'whiteboard');

    if (!channelUrl) {
      return Promise.reject(new ParameterError('Cannot share without channelUrl.'));
    }

    if (whiteboard) {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.share.initiated',
        payload: {
          mediaType: 'whiteboard',
        },
        options: {
          meetingId: this.id,
        },
      });

      const body: any = {
        disposition: FLOOR_ACTION.GRANTED,
        personUrl: this.locusInfo.self.url,
        deviceUrl: this.deviceUrl,
        uri: whiteboard.url,
        resourceUrl: channelUrl,
      };

      if (resourceToken) {
        body.resourceToken = resourceToken;
      }

      return this.meetingRequest
        .changeMeetingFloor(body)
        .then(() => {
          this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;

          return Promise.resolve();
        })
        .catch((error) => {
          LoggerProxy.logger.error('Meeting:index#startWhiteboardShare --> Error ', error);

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_START_WHITEBOARD_SHARE_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
            board: {channelUrl},
          });

          return Promise.reject(error);
        });
    }

    return Promise.reject(new ParameterError('Cannot share without whiteboard.'));
  }

  /**
   * Stop sharing whiteboard given channelUrl
   * @param {string} channelUrl whiteboard url
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public stopWhiteboardShare(channelUrl: string) {
    const whiteboard = this.locusInfo.mediaShares.find((element) => element.name === 'whiteboard');

    if (whiteboard) {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.share.stopped',
        payload: {
          mediaType: 'whiteboard',
        },
        options: {
          meetingId: this.id,
        },
      });

      return this.meetingRequest
        .changeMeetingFloor({
          disposition: FLOOR_ACTION.RELEASED,
          personUrl: this.locusInfo.self.url,
          deviceUrl: this.deviceUrl,
          uri: whiteboard.url,
        })
        .catch((error) => {
          LoggerProxy.logger.error('Meeting:index#stopWhiteboardShare --> Error ', error);

          Metrics.sendBehavioralMetric(
            // @ts-ignore - check if STOP_WHITEBOARD_SHARE_FAILURE exists
            BEHAVIORAL_METRICS.STOP_WHITEBOARD_SHARE_FAILURE,
            {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              board: {channelUrl},
            }
          );

          return Promise.reject(error);
        })
        .finally(() => {});
    }

    return Promise.reject(new ParameterError('Cannot stop share without whiteboard.'));
  }

  /**
   * Sends a request to Locus to obtain the screen share floor
   * @returns {Promise} see #meetingRequest.changeMeetingFloor
   * @private
   * @memberof Meeting
   */
  private requestScreenShareFloor() {
    if (
      !this.mediaProperties.hasLocalShareTrack() ||
      !this.mediaProperties.mediaDirection.sendShare
    ) {
      LoggerProxy.logger.log(
        `Meeting:index#requestScreenShareFloor --> NOT requesting floor, because we don't have the share track anymore (shareVideoTrack=${
          this.mediaProperties.shareVideoTrack ? 'yes' : 'no'
        }, shareAudioTrack=${this.mediaProperties.shareAudioTrack ? 'yes' : 'no'}, sendShare=${
          this.mediaProperties.mediaDirection.sendShare
        })`
      );
      this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;

      return Promise.resolve({});
    }
    if (this.state === MEETING_STATE.STATES.JOINED) {
      this.screenShareFloorState = ScreenShareFloorStatus.PENDING;
      const content = this.locusInfo.mediaShares.find((element) => element.name === CONTENT);

      if (content && this.shareStatus !== SHARE_STATUS.LOCAL_SHARE_ACTIVE) {
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.share.initiated',
          payload: {
            mediaType: 'share',
          },
          options: {meetingId: this.id},
        });

        return this.meetingRequest
          .changeMeetingFloor({
            disposition: FLOOR_ACTION.GRANTED,
            personUrl: this.locusInfo.self.url,
            deviceUrl: this.deviceUrl,
            uri: content.url,
            resourceUrl: this.resourceUrl,
            annotationInfo: this.annotationInfo,
          })
          .then(() => {
            this.screenShareFloorState = ScreenShareFloorStatus.GRANTED;

            return Promise.resolve();
          })
          .catch((error) => {
            LoggerProxy.logger.error('Meeting:index#share --> Error ', error);

            Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_SHARE_FAILURE, {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
            });

            this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;

            return Promise.reject(error);
          });
      }
      if (!content) {
        this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;

        return Promise.reject(new ParameterError('Cannot share without content.'));
      }

      return Promise.resolve();
    }
    this.floorGrantPending = true;

    return Promise.resolve({});
  }

  /**
   * Requests screen share floor if such request is pending.
   * It should be called whenever meeting state changes to JOINED
   *
   * @returns {void}
   */
  private requestScreenShareFloorIfPending() {
    if (this.floorGrantPending && this.state === MEETING_STATE.STATES.JOINED) {
      this.requestScreenShareFloor().then(() => {
        this.floorGrantPending = false;
      });
    }
  }

  /**
   * Sends a request to Locus to release the screen share floor.
   * @returns {Promise} see #meetingRequest.changeMeetingFloor
   * @private
   * @memberof Meeting
   */
  private releaseScreenShareFloor() {
    const content = this.locusInfo.mediaShares.find((element) => element.name === CONTENT);

    if (this.screenShareFloorState === ScreenShareFloorStatus.RELEASED) {
      return Promise.resolve();
    }
    this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;
    if (content) {
      // @ts-ignore
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.share.stopped',
        payload: {
          mediaType: 'share',
        },
        options: {meetingId: this.id},
      });

      if (content.floor?.beneficiary.id !== this.selfId) {
        // remote participant started sharing and caused our sharing to stop, we don't want to send any floor action request in that case
        return Promise.resolve();
      }

      return this.meetingRequest
        .changeMeetingFloor({
          disposition: FLOOR_ACTION.RELEASED,
          personUrl: this.locusInfo.self.url,
          deviceUrl: this.deviceUrl,
          uri: content.url,
          resourceUrl: this.resourceUrl,
        })
        .catch((error) => {
          LoggerProxy.logger.error('Meeting:index#releaseScreenShareFloor --> Error ', error);

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.STOP_FLOOR_REQUEST_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
          });

          return Promise.reject(error);
        });
    }

    // according to Locus there is no content, so we don't need to release the floor (it's probably already been released)
    return Promise.resolve();
  }

  /**
   * Intiate a recording of this meeting
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public startRecording() {
    return this.recordingController.startRecording();
  }

  /**
   * set the mute on entry flag for participants if you're the host
   * @returns {Promise}
   * @param {boolean} enabled
   * @public
   * @memberof Meeting
   */
  public setMuteOnEntry(enabled: boolean) {
    return this.controlsOptionsManager.setMuteOnEntry(enabled);
  }

  /**
   * set the disallow unmute flag for participants if you're the host
   * @returns {Promise}
   * @param {boolean} enabled
   * @public
   * @memberof Meeting
   */
  public setDisallowUnmute(enabled: boolean) {
    return this.controlsOptionsManager.setDisallowUnmute(enabled);
  }

  /**
   * set the mute all flag for participants if you're the host
   * @returns {Promise}
   * @param {boolean} mutedEnabled
   * @param {boolean} disallowUnmuteEnabled
   * @param {boolean} muteOnEntryEnabled
   * @public
   * @memberof Meeting
   */
  public setMuteAll(
    mutedEnabled: boolean,
    disallowUnmuteEnabled: boolean,
    muteOnEntryEnabled: boolean
  ) {
    return this.controlsOptionsManager.setMuteAll(
      mutedEnabled,
      disallowUnmuteEnabled,
      muteOnEntryEnabled
    );
  }

  /**
   * End the recording of this meeting
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public stopRecording() {
    return this.recordingController.stopRecording();
  }

  /**
   * Pauses the recording of this meeting
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public pauseRecording() {
    return this.recordingController.pauseRecording();
  }

  /**
   * Resumes the recording of this meeting
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public resumeRecording() {
    return this.recordingController.resumeRecording();
  }

  /**
   * Locks the current meeting if possible
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public lockMeeting() {
    return MeetingUtil.lockMeeting(this.inMeetingActions, this.meetingRequest, this.locusUrl);
  }

  /**
   * Unlocks the current meeting if possible
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public unlockMeeting() {
    return MeetingUtil.unlockMeeting(this.inMeetingActions, this.meetingRequest, this.locusUrl);
  }

  /**
   * Logs an error message and returns a rejected promise with same message
   * @param {String} message
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private rejectWithErrorLog(message: string) {
    LoggerProxy.logger.error(message);

    return Promise.reject(new Error(message));
  }

  /**
   * Sends DTMF tones to the current meeting
   * @param {String} tones a string of one or more DTMF tones to send
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public sendDTMF(tones: string) {
    if (this.locusInfo && this.locusInfo.self) {
      if (this.locusInfo.self.enableDTMF) {
        return this.meetingRequest.sendDTMF({
          locusUrl: this.locusInfo.self.url,
          deviceUrl: this.deviceUrl,
          tones,
        });
      }

      return this.rejectWithErrorLog(
        'Meeting:index#sendDTMF --> cannot send DTMF, meeting does not have DTMF enabled'
      );
    }

    return this.rejectWithErrorLog(
      'Meeting:index#sendDTMF --> cannot send DTMF, meeting does not have a connection to the "locus" call control service. Have you joined?'
    );
  }

  /**
   * Sends request to change layout type for the current meeting for the specific participant/device only
   * @param {String} [layoutType] a layout type that should be available in meeting constants {@link #layout_types}
   * @param {Object} renderInfo preferred dimensions for the remote main and content streams (server can ignore it)
   * @param {Object} renderInfo.main preferred dimensions for the remote main video stream
   * @param {Number} renderInfo.main.width preferred width of main video stream
   * @param {Number} renderInfo.main.height preferred height of main video stream
   * @param {Object} renderInfo.content preferred dimensions for the remote content share stream
   * @param {Number} renderInfo.content.width preferred width of content share stream
   * @param {Number} renderInfo.content.height preferred height of content share stream
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public changeVideoLayout(
    layoutType?: string,
    renderInfo: {
      main: {
        width: number;
        height: number;
      };
      content: {
        width: number;
        height: number;
      };
    } = {} as any
  ) {
    const {main, content} = renderInfo;
    const {mediaDirection, remoteShare, remoteVideoTrack} = this.mediaProperties;

    const layoutInfo = cloneDeep(this.lastVideoLayoutInfo);

    // TODO: We need a real time value for Audio, Video and Share send indicator
    if (mediaDirection.receiveVideo !== true || !remoteVideoTrack) {
      return this.rejectWithErrorLog(
        'Meeting:index#changeVideoLayout --> cannot change video layout, you are not recieving any video/share stream'
      );
    }

    if (layoutType) {
      if (!LAYOUT_TYPES.includes(layoutType)) {
        this.rejectWithErrorLog(
          'Meeting:index#changeVideoLayout --> cannot change video layout, invalid layoutType recieved.'
        );
      }

      layoutInfo.layoutType = layoutType;
    }

    if (main) {
      const mainWidth = Math.round(main.width);
      const mainHeight = Math.round(main.height);

      // Stop any "twitching" caused by very slight size changes
      if (
        !this.lastVideoLayoutInfo.main ||
        Math.abs(this.lastVideoLayoutInfo.main.height - mainHeight) > 2 ||
        Math.abs(this.lastVideoLayoutInfo.main.width - mainWidth) > 2
      ) {
        layoutInfo.main = {width: mainWidth, height: mainHeight};
      }
    }

    if (content) {
      if (this.mediaProperties.mediaDirection.receiveShare && remoteShare) {
        const contentWidth = Math.round(content.width);
        const contentHeight = Math.round(content.height);

        // Stop any "twitching" caused by very slight size changes
        if (
          !this.lastVideoLayoutInfo.content ||
          Math.abs(this.lastVideoLayoutInfo.content.height - contentHeight) > 2 ||
          Math.abs(this.lastVideoLayoutInfo.content.width - contentWidth) > 2
        ) {
          layoutInfo.content = {width: contentWidth, height: contentHeight};
        }
      } else {
        return this.rejectWithErrorLog(
          'Meeting:index#changeVideoLayout --> unable to send renderInfo for content, you are not receiving remote share'
        );
      }
    }

    if (isEqual(layoutInfo, this.lastVideoLayoutInfo)) {
      // nothing changed, no need to send any request
      return Promise.resolve();
    }
    this.lastVideoLayoutInfo = cloneDeep(layoutInfo);

    this.locusInfo.once(LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED, (envelope) => {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'changeVideoLayout',
        },
        EVENT_TRIGGERS.MEETING_CONTROLS_LAYOUT_UPDATE,
        {
          layout: envelope.layout,
        }
      );
    });

    return this.meetingRequest
      .changeVideoLayoutDebounced({
        locusUrl: this.locusInfo.self.url,
        deviceUrl: this.deviceUrl,
        layoutType,
        main: layoutInfo.main,
        content: layoutInfo.content,
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:index#changeVideoLayout --> Error ', error);

        return Promise.reject(error);
      });
  }

  /**
   * Sets the quality level of the remote incoming media
   * @param {String} level {LOW|MEDIUM|HIGH}
   * @returns {Promise}
   */
  setRemoteQualityLevel(level: string) {
    LoggerProxy.logger.log(`Meeting:index#setRemoteQualityLevel --> Setting quality to ${level}`);

    if (!QUALITY_LEVELS[level]) {
      return this.rejectWithErrorLog(
        `Meeting:index#setRemoteQualityLevel --> ${level} not defined`
      );
    }

    if (
      !this.mediaProperties.mediaDirection.receiveAudio &&
      !this.mediaProperties.mediaDirection.receiveVideo
    ) {
      return this.rejectWithErrorLog(
        'Meeting:index#setRemoteQualityLevel --> unable to change remote quality, receiveVideo and receiveAudio is disabled'
      );
    }

    // If level is already the same, don't do anything
    if (level === this.mediaProperties.remoteQualityLevel) {
      LoggerProxy.logger.warn(
        `Meeting:index#setRemoteQualityLevel --> Quality already set to ${level}`
      );

      return Promise.resolve();
    }

    // Set the quality level in properties
    this.mediaProperties.setRemoteQualityLevel(level);

    return this.updateTranscodedMediaConnection();
  }

  /**
   * Functionality for when a share audio is ended.
   * @private
   * @memberof Meeting
   * @returns {undefined}
   */
  private handleShareAudioTrackEnded = async () => {
    // current share audio track has ended, but there might be an active
    // share video track. we only leave from wireless share if share has
    // completely ended, which means no share audio or video tracks active
    if (this.wirelessShare && !this.mediaProperties.shareVideoTrack) {
      this.leave({reason: MEETING_REMOVED_REASON.USER_ENDED_SHARE_STREAMS});
    } else {
      try {
        await this.unpublishTracks([this.mediaProperties.shareAudioTrack]);
      } catch (error) {
        LoggerProxy.logger.log(
          'Meeting:index#handleShareAudioTrackEnded --> Error stopping share: ',
          error
        );
      }
    }
    this.triggerStoppedSharing();
  };

  /**
   * Functionality for when a share video is ended.
   * @private
   * @memberof Meeting
   * @returns {undefined}
   */
  private handleShareVideoTrackEnded = async () => {
    // current share video track has ended, but there might be an active
    // share audio track. we only leave from wireless share if share has
    // completely ended, which means no share audio or video tracks active
    if (this.wirelessShare && !this.mediaProperties.shareAudioTrack) {
      this.leave({reason: MEETING_REMOVED_REASON.USER_ENDED_SHARE_STREAMS});
    } else {
      try {
        await this.unpublishTracks([this.mediaProperties.shareVideoTrack]);
      } catch (error) {
        LoggerProxy.logger.log(
          'Meeting:index#handleShareVideoTrackEnded --> Error stopping share: ',
          error
        );
      }
    }
    this.triggerStoppedSharing();
  };

  /**
   * Emits meeting:stoppedSharingLocal
   * @private
   * @returns {undefined}
   * @memberof Meeting
   */
  private triggerStoppedSharing = () => {
    if (!this.mediaProperties.hasLocalShareTrack()) {
      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'handleShareTrackEnded',
        },
        EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
        {
          reason: SHARE_STOPPED_REASON.TRACK_ENDED,
        }
      );
    }
  };

  /**
   * Emits the 'network:quality' event
   * 1 indicates an acceptable uplink network.
   * 0 indicates an unacceptable uplink network based on a predefined threshold
   * @returns {undefined}
   * @param {Object} res - payload of emitNetworkQuality
   * @property {string} mediaType {video|audio}
   * @property {number} networkQualityScore - {1|0}
   * @private
   * @memberof Meeting
   */
  private sendNetworkQualityEvent(res: any) {
    Trigger.trigger(
      this,
      {
        file: 'meeting/index',
        function: 'addMedia',
      },
      EVENT_TRIGGERS.NETWORK_QUALITY,
      {
        networkQualityScore: res.networkQualityScore,
        mediaType: res.mediaType,
      }
    );
  }

  /**
   * Handle logging the media
   * @param {Object} mediaProperties
   * @private
   * @returns {undefined}
   */
  private handleMediaLogging(mediaProperties: {
    audioTrack?: LocalMicrophoneTrack;
    videoTrack?: LocalCameraTrack;
  }) {
    MeetingUtil.handleVideoLogging(mediaProperties.videoTrack);
    MeetingUtil.handleAudioLogging(mediaProperties.audioTrack);
  }

  /**
   *
   * @returns {string} one of 'attendee','host','cohost', returns the user type of the current user
   */
  getCurUserType() {
    const {roles} = this;
    if (roles) {
      if (roles.includes(SELF_ROLES.MODERATOR)) {
        return 'host';
      }
      if (roles.includes(SELF_ROLES.COHOST)) {
        return 'cohost';
      }
      if (roles.includes(SELF_ROLES.ATTENDEE)) {
        return 'attendee';
      }
    }

    return null;
  }

  /**
   * End the current meeting for all
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public endMeetingForAll() {
    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.call.leave',
      payload: {trigger: 'user-interaction', canProceed: false},
      options: {meetingId: this.id},
    });

    LoggerProxy.logger.log('Meeting:index#endMeetingForAll --> End meeting for All');
    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_END_ALL_INITIATED, {
      correlation_id: this.correlationId,
      locus_id: this.locusId,
    });

    return MeetingUtil.endMeetingForAll(this)
      .then((end) => {
        this.meetingFiniteStateMachine.end();

        this.clearMeetingData();
        // upload logs on leave irrespective of meeting delete
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'endMeetingForAll',
          },
          EVENTS.REQUEST_UPLOAD_LOGS,
          this
        );

        return end;
      })
      .catch((error) => {
        this.meetingFiniteStateMachine.fail(error);
        LoggerProxy.logger.error(
          'Meeting:index#endMeetingForAll --> Failed to end meeting ',
          error
        );
        // upload logs on leave irrespective of meeting delete
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'endMeetingForAll',
          },
          EVENTS.REQUEST_UPLOAD_LOGS,
          this
        );
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_END_ALL_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
          code: error.code,
        });

        return Promise.reject(error);
      });
  }

  /**
   * clear the meeting data
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  clearMeetingData = () => {
    this.audio = null;
    this.video = null;
    this.screenShareFloorState = ScreenShareFloorStatus.RELEASED;
    if (this.shareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE) {
      this.shareStatus = SHARE_STATUS.NO_SHARE;
    }
    this.queuedMediaUpdates = [];

    if (this.transcription) {
      this.transcription.closeSocket();
      this.triggerStopReceivingTranscriptionEvent();
      this.transcription = undefined;
    }
  };

  /**
   * starts keepAlives being sent
   * @returns {void}
   * @private
   * @memberof Meeting
   */
  startKeepAlive = () => {
    if (this.keepAliveTimerId) {
      LoggerProxy.logger.warn(
        'Meeting:index#startKeepAlive --> keepAlive not started: keepAliveTimerId already exists'
      );

      return;
    }
    if (!this.joinedWith?.keepAliveUrl) {
      LoggerProxy.logger.warn(
        'Meeting:index#startKeepAlive --> keepAlive not started: no keepAliveUrl'
      );

      return;
    }
    if (!this.joinedWith?.keepAliveSecs) {
      LoggerProxy.logger.warn(
        'Meeting:index#startKeepAlive --> keepAlive not started: no keepAliveSecs'
      );

      return;
    }
    if (this.joinedWith.keepAliveSecs <= 1) {
      LoggerProxy.logger.warn(
        'Meeting:index#startKeepAlive --> keepAlive not started: keepAliveSecs <= 1'
      );

      return;
    }
    const {keepAliveUrl} = this.joinedWith;
    const keepAliveInterval = (this.joinedWith.keepAliveSecs - 1) * 750; // taken from UCF

    this.keepAliveTimerId = setInterval(() => {
      this.meetingRequest.keepAlive({keepAliveUrl}).catch((error) => {
        LoggerProxy.logger.warn(
          `Meeting:index#startKeepAlive --> Stopping sending keepAlives to ${keepAliveUrl} after error ${error}`
        );
        this.stopKeepAlive();
      });
    }, keepAliveInterval);
  };

  /**
   * stops keepAlives being sent
   * @returns {void}
   * @private
   * @memberof Meeting
   */
  stopKeepAlive = () => {
    if (!this.keepAliveTimerId) {
      return;
    }
    clearInterval(this.keepAliveTimerId);
    this.keepAliveTimerId = null;
  };

  /**
   * Send a reaction inside the meeting.
   *
   * @param {ReactionServerType} reactionType - type of reaction to be sent. Example: "thumbs_up"
   * @param {SkinToneType} skinToneType - skin tone for the reaction. Example: "medium_dark"
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public sendReaction(reactionType: ReactionServerType, skinToneType?: SkinToneType) {
    const reactionChannelUrl = this.locusInfo?.controls?.reactions?.reactionChannelUrl as string;
    const participantId = this.members.selfId;

    const reactionData = Reactions[reactionType];

    if (!reactionData) {
      return Promise.reject(new Error(`${reactionType} is not a valid reaction.`));
    }
    const skinToneData = SkinTones[skinToneType] || SkinTones.normal;
    const reaction: Reaction = {
      ...reactionData,
      tone: skinToneData,
    };

    if (reactionChannelUrl) {
      return this.meetingRequest.sendReaction({reactionChannelUrl, reaction, participantId});
    }

    return Promise.reject(new Error('Error sending reaction, service url not found.'));
  }

  /**
   * Method to enable or disable reactions inside the meeting.
   *
   * @param  {boolean} enable - enable or disable reactions
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public toggleReactions(enable: boolean) {
    const isEnabled = this.locusInfo?.controls?.reactions?.enabled;

    if ((isEnabled && enable) || (!isEnabled && !enable)) {
      return Promise.resolve(`Reactions are already ${isEnabled ? 'enabled' : 'disabled'}.`);
    }

    return this.meetingRequest.toggleReactions({
      enable,
      locusUrl: this.locusUrl,
      requestingParticipantId: this.members.selfId,
    });
  }

  /**
   * Throws if we don't have a media connection created
   *
   * @returns {void}
   */
  private checkMediaConnection() {
    if (this.mediaProperties?.webrtcMediaConnection) {
      return;
    }
    throw new NoMediaEstablishedYetError();
  }

  /**
   * Method to enable or disable the 'Music mode' effect on audio track
   *
   * @param {boolean} shouldEnableMusicMode
   * @returns {Promise}
   */
  async enableMusicMode(shouldEnableMusicMode: boolean) {
    this.checkMediaConnection();

    if (!this.isMultistream) {
      throw new Error('enableMusicMode() only supported with multistream');
    }

    if (shouldEnableMusicMode) {
      await this.mediaProperties.webrtcMediaConnection.setCodecParameters(MediaType.AudioMain, {
        maxaveragebitrate: '64000',
        maxplaybackrate: '48000',
      });
    } else {
      await this.mediaProperties.webrtcMediaConnection.deleteCodecParameters(MediaType.AudioMain, [
        'maxaveragebitrate',
        'maxplaybackrate',
      ]);
    }
  }

  /** Updates the tracks being sent on the transcoded media connection
   *
   * @returns {Promise<void>}
   */
  private updateTranscodedMediaConnection(): Promise<void> {
    const LOG_HEADER = 'Meeting:index#updateTranscodedMediaConnection -->';

    LoggerProxy.logger.info(`${LOG_HEADER} starting`);

    if (!this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.TRANSCODED_MEDIA_CONNECTION);
    }

    return this.mediaProperties.webrtcMediaConnection
      .update({
        localTracks: {
          audio: this.mediaProperties.audioTrack?.underlyingTrack || null,
          video: this.mediaProperties.videoTrack?.underlyingTrack || null,
          screenShareVideo: this.mediaProperties.shareVideoTrack?.underlyingTrack || null,
        },
        direction: {
          audio: Media.getDirection(
            true,
            this.mediaProperties.mediaDirection.receiveAudio,
            this.mediaProperties.mediaDirection.sendAudio
          ),
          video: Media.getDirection(
            true,
            this.mediaProperties.mediaDirection.receiveVideo,
            this.mediaProperties.mediaDirection.sendVideo
          ),
          screenShareVideo: Media.getDirection(
            false,
            this.mediaProperties.mediaDirection.receiveShare,
            this.mediaProperties.mediaDirection.sendShare
          ),
        },
        remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
      })
      .then(() => {
        LoggerProxy.logger.info(`${LOG_HEADER} done`);
      })
      .catch((error) => {
        LoggerProxy.logger.error(`${LOG_HEADER} Error: `, error);

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UPDATE_MEDIA_FAILURE, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          reason: error.message,
          stack: error.stack,
        });

        throw error;
      });
  }

  /**
   * Publishes a track.
   *
   * @param {LocalTrack} track to publish
   * @returns {Promise}
   */
  private async publishTrack(track?: LocalTrack) {
    if (!track) {
      return;
    }

    if (this.mediaProperties.webrtcMediaConnection) {
      if (this.isMultistream) {
        await this.mediaProperties.webrtcMediaConnection.publishTrack(track);
      } else {
        track.setPublished(true); // for multistream, this call is done by WCME
      }
    }
  }

  /**
   * Un-publishes a track.
   *
   * @param {LocalTrack} track to unpublish
   * @returns {Promise}
   */
  private async unpublishTrack(track?: LocalTrack) {
    if (!track) {
      return;
    }

    if (this.isMultistream && this.mediaProperties.webrtcMediaConnection) {
      await this.mediaProperties.webrtcMediaConnection.unpublishTrack(track);
    } else {
      track.setPublished(false); // for multistream, this call is done by WCME
    }
  }

  /**
   * Publishes specified local tracks in the meeting
   *
   * @param {Object} tracks
   * @returns {Promise}
   */
  async publishTracks(tracks: LocalTracks): Promise<void> {
    this.checkMediaConnection();

    this.annotationInfo = tracks.annotationInfo;

    if (
      !tracks.microphone &&
      !tracks.camera &&
      !tracks.screenShare?.audio &&
      !tracks.screenShare?.video
    ) {
      // nothing to do
      return;
    }

    let floorRequestNeeded = false;

    if (tracks.screenShare?.video) {
      await this.setLocalShareVideoTrack(tracks.screenShare?.video);

      floorRequestNeeded = this.screenShareFloorState === ScreenShareFloorStatus.RELEASED;
    }

    if (this.isMultistream && tracks.screenShare?.audio) {
      await this.setLocalShareAudioTrack(tracks.screenShare.audio);

      floorRequestNeeded = this.screenShareFloorState === ScreenShareFloorStatus.RELEASED;
    }

    if (tracks.microphone) {
      await this.setLocalAudioTrack(tracks.microphone);
    }

    if (tracks.camera) {
      await this.setLocalVideoTrack(tracks.camera);
    }

    if (!this.isMultistream) {
      await this.updateTranscodedMediaConnection();
    }

    if (floorRequestNeeded) {
      // we're sending the http request to Locus to request the screen share floor
      // only after the SDP update, because that's how it's always been done for transcoded meetings
      // and also if sharing from the start, we need confluence to have been created
      await this.enqueueScreenShareFloorRequest();
    }
  }

  /**
   * Un-publishes specified local tracks in the meeting
   *
   * @param {Array<MediaStreamTrack>} tracks
   * @returns {Promise}
   */
  async unpublishTracks(tracks: LocalTrack[]): Promise<void> {
    this.checkMediaConnection();

    const promises = [];

    for (const track of tracks.filter((t) => !!t)) {
      if (track === this.mediaProperties.shareVideoTrack) {
        promises.push(this.setLocalShareVideoTrack(undefined));
      }

      if (track === this.mediaProperties.shareAudioTrack) {
        promises.push(this.setLocalShareAudioTrack(undefined));
      }

      if (track === this.mediaProperties.audioTrack) {
        promises.push(this.setLocalAudioTrack(undefined));
      }

      if (track === this.mediaProperties.videoTrack) {
        promises.push(this.setLocalVideoTrack(undefined));
      }
    }

    if (!this.isMultistream) {
      promises.push(this.updateTranscodedMediaConnection());
    }

    await Promise.all(promises);

    // we're allowing for the SDK to support just audio share as well
    // so a share could be active with only video, only audio, or both
    // we're only releasing the floor if both tracks have ended
    if (!this.mediaProperties.hasLocalShareTrack()) {
      try {
        this.releaseScreenShareFloor(); // we ignore the returned promise here on purpose
      } catch (e) {
        // nothing to do here, error is logged already inside releaseScreenShareFloor()
      }
    }
  }
}
