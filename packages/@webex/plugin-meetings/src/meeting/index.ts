import uuid from 'uuid';
import {cloneDeep, isEqual, pick, isString, defer} from 'lodash';
// @ts-ignore - Fix this
import {StatelessWebexPlugin} from '@webex/webex-core';
import {
  ConnectionState,
  Errors,
  ErrorType,
  Event,
  LocalCameraTrack,
  LocalDisplayTrack,
  LocalMicrophoneTrack,
  LocalTrackEvents,
  MediaType,
  RemoteTrackType,
} from '@webex/internal-media-core';

import {
  MeetingNotActiveError,
  createMeetingsError,
  UserInLobbyError,
  NoMediaEstablishedYetError,
  UserNotJoinedError,
} from '../common/errors/webex-errors';
import {StatsAnalyzer, EVENTS as StatsAnalyzerEvents} from '../statsAnalyzer';
import NetworkQualityMonitor from '../networkQualityMonitor';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import Roap from '../roap/index';
import Media from '../media';
import MediaProperties from '../media/properties';
import MeetingStateMachine from './state';
import {createMuteState} from './muteState';
import LocusInfo from '../locus-info';
import Metrics from '../metrics';
import {trigger, mediaType, error as MetricsError, eventType} from '../metrics/config';
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
  METRICS_JOIN_TIMES_MAX_DURATION,
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
  VIDEO_RESOLUTIONS,
  VIDEO,
  HTTP_VERBS,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import ParameterError from '../common/errors/parameter';
import MediaError from '../common/errors/media';
import {
  MeetingInfoV2PasswordError,
  MeetingInfoV2CaptchaError,
} from '../meeting-info/meeting-info-v2';
import BrowserDetection from '../common/browser-detection';
import {ReceiveSlotManager} from '../multistream/receiveSlotManager';
import {MediaRequestManager} from '../multistream/mediaRequestManager';
import {
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

import InMeetingActions from './in-meeting-actions';
import {REACTION_RELAY_TYPES} from '../reactions/constants';
import RecordingController from '../recording-controller';
import ControlsOptionsManager from '../controls-options-manager';

const {isBrowser} = BrowserDetection();

const logRequest = (request: any, {header = '', success = '', failure = ''}) => {
  LoggerProxy.logger.info(header);

  return request
    .then((arg) => {
      LoggerProxy.logger.info(success);

      return arg;
    })
    .catch((error) => {
      LoggerProxy.logger.error(failure, error);
      throw error;
    });
};

export const MEDIA_UPDATE_TYPE = {
  ALL: 'ALL',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  SHARE: 'SHARE',
  LAMBDA: 'LAMBDA',
};

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
 * AudioVideo
 * @typedef {Object} AudioVideo
 * @property {Object} audio
 * @property {String} audio.deviceId
 * @property {Object} video
 * @property {String} video.deviceId
 * @property {String} video.localVideoQuality // [240p, 360p, 480p, 720p, 1080p]
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
 * @property {String} [meetingQuality.local]
 * @property {String} [meetingQuality.remote]
 * @property {Boolean} [rejoin]
 * @property {Boolean} [enableMultistream]
 */

/**
 * SendOptions
 * @typedef {Object} SendOptions
 * @property {Boolean} sendAudio
 * @property {Boolean} sendVideo
 * @property {Boolean} sendShare
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
 * @memberof Meeting
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
  meetingInfo: object;
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
  isSharing: boolean;
  keepAliveTimerId: NodeJS.Timeout;
  lastVideoLayoutInfo: any;
  locusInfo: any;
  mediaProperties: MediaProperties;
  mediaRequestManagers: {
    audio: MediaRequestManager;
    video: MediaRequestManager;
    screenShareAudio: MediaRequestManager;
    screenShareVideo: MediaRequestManager;
  };

  meetingInfoFailureReason: string;
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
  shareStatus: string;
  statsAnalyzer: StatsAnalyzer;
  transcription: Transcription;
  updateMediaConnections: (mediaConnections: any[]) => void;
  endCallInitiateJoinReq: any;
  endJoinReqResp: any;
  endLocalSDPGenRemoteSDPRecvDelay: any;
  joinedWith: any;
  locusId: any;
  startCallInitiateJoinReq: any;
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

  namespace = MEETINGS;

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
     * Correlation ID used for network tracking of meeting join
     * @instance
     * @type {String}
     * @readonly
     * @public
     * @memberof Meeting
     */
    this.correlationId = this.id;
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
    this.breakouts = new Breakouts({}, {parent: this.webex});
    /**
     * helper class for managing receive slots (for multistream media connections)
     */
    this.receiveSlotManager = new ReceiveSlotManager(this);
    /**
     * Object containing helper classes for managing media requests for audio/video/screenshare (for multistream media connections)
     * All multistream media requests sent out for this meeting have to go through them.
     */
    this.mediaRequestManagers = {
      // @ts-ignore - config coming from registerPlugin
      audio: new MediaRequestManager(this.config.degradationPreferences, (mediaRequests) => {
        if (!this.mediaProperties.webrtcMediaConnection) {
          LoggerProxy.logger.warn(
            'Meeting:index#mediaRequestManager --> trying to send audio media request before media connection was created'
          );

          return;
        }
        this.mediaProperties.webrtcMediaConnection.requestMedia(MediaType.AudioMain, mediaRequests);
      }),
      // @ts-ignore - config coming from registerPlugin
      video: new MediaRequestManager(this.config.degradationPreferences, (mediaRequests) => {
        if (!this.mediaProperties.webrtcMediaConnection) {
          LoggerProxy.logger.warn(
            'Meeting:index#mediaRequestManager --> trying to send video media request before media connection was created'
          );

          return;
        }
        this.mediaProperties.webrtcMediaConnection.requestMedia(MediaType.VideoMain, mediaRequests);
      }),
      screenShareAudio: new MediaRequestManager(
        // @ts-ignore - config coming from registerPlugin
        this.config.degradationPreferences,
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
        }
      ),
      screenShareVideo: new MediaRequestManager(
        // @ts-ignore - config coming from registerPlugin
        this.config.degradationPreferences,
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
     * created later
     * @instance
     * @type {MuteState}
     * @private
     * @memberof Meeting
     */
    this.audio = null;
    /**
     * created later
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
    this.meetingRequest = new MeetingRequest({}, options);
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
     * This is deprecated, please use shareStatus instead.
     * @instance
     * @type {Boolean}
     * @readonly
     * @public
     * @memberof Meeting
     * @deprecated after v1.118.13
     */
    this.isSharing = false;
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
  }: {
    password?: string;
    captchaCode?: string;
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
        captchaInfo
      );

      this.parseMeetingInfo(info, this.destination);
      this.meetingInfo = info ? info.body : null;
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
      if (err instanceof MeetingInfoV2PasswordError) {
        LoggerProxy.logger.info(
          // @ts-ignore
          `Meeting:index#fetchMeetingInfo --> Info Unable to fetch meeting info for ${this.destination} - password required (code=${err?.body?.code}).`
        );

        // when wbxappapi requires password it still populates partial meeting info in the response
        if (err.meetingInfo) {
          this.meetingInfo = err.meetingInfo;
          this.meetingNumber = err.meetingInfo.meetingNumber;
        }

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
   * get the metrics payload pre
   * @param {Object} options
   * @param {String} options.event
   * @param {String} options.trackingId
   * @param {Object} options.locus
   * @param {Array} options.mediaConnections
   * @param {Object} options.errors
   * @returns {Object}
   * @memberof Meeting
   */
  getAnalyzerMetricsPrePayload(
    options:
      | {
          event: string;
          trackingId: string;
          locus: object;
          mediaConnections: Array<any>;
          errors: object;
        }
      | any
  ) {
    if (options) {
      const {event, trackingId, mediaConnections} = options;

      if (!event) {
        LoggerProxy.logger.error(
          'Meeting:index#getAnalyzerMetricsPrePayload --> Error [Call Analyzer Event',
          event || '',
          `]: invalid identifers or event type! ${this.correlationId}`
        );

        return null;
      }

      const identifiers: any = {
        correlationId: this.correlationId,
        userId: this.userId,
        deviceId: this.deviceUrl,
        orgId: this.orgId,
        // @ts-ignore fix type
        locusUrl: this.webex.internal.services.get('locus'),
      };

      if (this.locusUrl && this.locusInfo.fullState) {
        identifiers.locusUrl = this.locusUrl;
        identifiers.locusId = this.locusUrl && this.locusUrl.split('/').pop();
        identifiers.locusStartTime =
          this.locusInfo.fullState && this.locusInfo.fullState.lastActive;
      }

      // Check if mediaConnections has been passed in or else use this.mediaConnections
      if (mediaConnections) {
        identifiers.mediaAgentAlias = mediaConnections?.[0].mediaAgentAlias;
        identifiers.mediaAgentGroupId = mediaConnections?.[0].mediaAgentGroupId;
        identifiers.mediaAgentCluster = mediaConnections?.[0].mediaAgentCluster;
      } else if (this.mediaConnections) {
        identifiers.mediaAgentAlias = this.mediaConnections?.[0].mediaAgentAlias;
        identifiers.mediaAgentGroupId = this.mediaConnections?.[0].mediaAgentGroupId;
        identifiers.mediaAgentCluster = this.mediaConnections?.[0].mediaAgentCluster;
      }

      if (options.trackingId) {
        identifiers.trackingId = trackingId;
      }

      let payload = {};

      const joinRespRxStartAudio = this.getSetupDelayDuration('audio');

      if (joinRespRxStartAudio) {
        options.audioSetupDelay = {
          joinRespRxStart: joinRespRxStartAudio,
        };
      }

      const joinRespRxStartVideo = this.getSetupDelayDuration('video');

      if (joinRespRxStartAudio) {
        options.videoSetupDelay = {
          joinRespRxStart: joinRespRxStartVideo,
        };
      }

      const joinRespTxStartAudio = this.getSendingMediaDelayDuration('audio');

      if (joinRespTxStartAudio) {
        options.audioSetupDelay = {
          ...options.audioSetupDelay,
          joinRespTxStart: joinRespTxStartAudio,
        };
      }

      const joinRespTxStartVideo = this.getSendingMediaDelayDuration('video');

      if (joinRespTxStartVideo) {
        options.videoSetupDelay = {
          ...options.videoSetupDelay,
          joinRespTxStart: joinRespTxStartVideo,
        };
      }

      const localSDPGenRemoteSDPRecv = this.getLocalSDPGenRemoteSDPRecvDelay();

      if (localSDPGenRemoteSDPRecv) {
        options.joinTimes = {
          ...options.joinTimes,
          localSDPGenRemoteSDPRecv,
        };
      }

      const callInitiateJoinReq = this.getCallInitiateJoinReq();

      if (callInitiateJoinReq) {
        options.joinTimes = {
          ...options.joinTimes,
          callInitiateJoinReq,
        };
      }

      const joinReqResp = this.getJoinReqResp();

      if (joinReqResp) {
        options.joinTimes = {
          ...options.joinTimes,
          joinReqResp,
        };
      }

      const getTotalJmt = this.getTotalJmt();

      if (getTotalJmt) {
        options.joinTimes = {
          ...options.joinTimes,
          getTotalJmt,
        };
      }

      if (options.type === MQA_STATS.CA_TYPE) {
        payload = Metrics.initMediaPayload(options.event, identifiers, options);
      } else {
        payload = Metrics.initPayload(options.event, identifiers, options);
      }

      return payload;
    }

    return null;
  }

  /**
   * Send the metrics to call-analyzer dashboard
   * @param {Object} options
   * @param {String} options.event
   * @param {String} options.trackingId
   * @param {Object} options.locus
   * @param {Object} options.errors
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private sendCallAnalyzerMetrics(options: {
    event: string;
    trackingId: string;
    locus: object;
    errors: object;
  }) {
    const payload = this.getAnalyzerMetricsPrePayload({
      // @ts-ignore - config coming from registerPlugin
      ...pick(this.config.metrics, ['clientType', 'subClientType']),
      ...options,
    });

    // @ts-ignore - fix type
    return this.webex.internal.metrics.submitCallDiagnosticEvents(payload);
  }

  /**
   * Send the metrics to Media Quality Analyzer dashboard
   * @param {Object} options
   * @param {String} options.event
   * @param {String} options.trackingId
   * @param {Object} options.locus
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private sendMediaQualityAnalyzerMetrics(options: {
    event: string;
    trackingId: string;
    locus: object;
  }) {
    const payload = this.getAnalyzerMetricsPrePayload({
      type: MQA_STATS.CA_TYPE,
      // @ts-ignore - config coming from registerPlugin
      ...pick(this.config.metrics, ['clientType', 'subClientType']),
      ...options,
    });

    // @ts-ignore
    return this.webex.internal.metrics.submitCallDiagnosticEvents(payload);
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
      if (this.floorGrantPending && payload.newSelf.state === MEETING_STATE.STATES.JOINED) {
        this.requestScreenShareFloor().then(() => {
          this.floorGrantPending = false;
        });
      }
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
        // @ts-ignore originalTrack is private - this will be fixed when SPARK-399694 are SPARK-399695 done
        const localShareTrack = this.mediaProperties.shareTrack?.originalTrack;

        // todo: remove this block of code and instead make sure we have LocalTrackEvents.Ended listener always registered (SPARK-399695)
        if (localShareTrack?.readyState === 'ended') {
          try {
            if (this.isMultistream) {
              await this.unpublishTracks([localShareTrack]); // todo screen share audio (SPARK-399690)
            } else {
              await this.stopShare({
                skipSignalingCheck: true,
              });
            }
          } catch (error) {
            LoggerProxy.logger.log(
              'Meeting:index#setUpLocusMediaSharesListener --> Error stopping share: ',
              error
            );
          }
        } else {
          // CONTENT - sharing content local
          newShareStatus = SHARE_STATUS.LOCAL_SHARE_ACTIVE;
        }
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
                }
              );
            };

            try {
              // if a remote participant is stealing the presentation from us
              if (
                this.mediaProperties.mediaDirection?.sendShare &&
                oldShareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE
              ) {
                if (this.isMultistream) {
                  // @ts-ignore originalTrack is private - this will be fixed in SPARK-399694
                  await this.unpublishTracks([this.mediaProperties.shareTrack?.originalTrack]); // todo screen share audio (SPARK-399690)
                } else {
                  await this.updateShare({
                    sendShare: false,
                    receiveShare: this.mediaProperties.mediaDirection.receiveShare,
                  });
                }
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
            Metrics.postEvent({event: eventType.LOCAL_SHARE_FLOOR_GRANTED, meeting: this});
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
            Metrics.postEvent({event: eventType.WHITEBOARD_SHARE_FLOOR_GRANTED, meeting: this});
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
        Metrics.postEvent({event: eventType.WHITEBOARD_SHARE_FLOOR_GRANTED, meeting: this});
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
          canStartRecording: RecordingUtil.canUserStart(payload.info.userDisplayHints),
          canStopRecording: RecordingUtil.canUserStop(payload.info.userDisplayHints),
          canPauseRecording: RecordingUtil.canUserPause(payload.info.userDisplayHints),
          canResumeRecording: RecordingUtil.canUserResume(payload.info.userDisplayHints),
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
          isWebexAssistantActive: MeetingUtil.isWebexAssistantActive(payload.info.userDisplayHints),
          canViewCaptionPanel: MeetingUtil.canViewCaptionPanel(payload.info.userDisplayHints),
          isRealTimeTranslationEnabled: MeetingUtil.isRealTimeTranslationEnabled(
            payload.info.userDisplayHints
          ),
          canSelectSpokenLanguages: MeetingUtil.canSelectSpokenLanguages(
            payload.info.userDisplayHints
          ),
          waitingForOthersToJoin: MeetingUtil.waitingForOthersToJoin(payload.info.userDisplayHints),
          canEnableReactions: MeetingUtil.canEnableReactions(
            this.inMeetingActions.canEnableReactions,
            payload.info.userDisplayHints
          ),
          canSendReactions: MeetingUtil.canSendReactions(
            this.inMeetingActions.canSendReactions,
            payload.info.userDisplayHints
          ),
        });

        this.recordingController.setDisplayHints(payload.info.userDisplayHints);
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
    this.locusInfo.on(LOCUSINFO.EVENTS.SELF_REMOTE_MUTE_STATUS_UPDATED, (payload) => {
      if (payload) {
        if (this.audio) {
          this.audio.handleServerRemoteMuteUpdate(payload.muted, payload.unmuteAllowed);
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

        Metrics.postEvent({
          event: eventType.LOBBY_ENTERED,
          meeting: this,
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

        Metrics.postEvent({
          event: eventType.LOBBY_EXITED,
          meeting: this,
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
    this.locusInfo.on(EVENTS.DESTROY_MEETING, (payload) => {
      // if self state is NOT left

      // TODO: Handle sharing and wireless sharing when meeting end
      if (this.wirelessShare) {
        if (this.mediaProperties.shareTrack) {
          this.setLocalShareTrack(null);
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

        this.leave({reason: payload.reason})
          .then(() => {
            LoggerProxy.logger.warn(
              'Meeting:index#setUpLocusInfoMeetingListener --> DESTROY_MEETING. The meeting has been left, but has not been destroyed, you should see a later event for leave.'
            );
          })
          .catch((error) => {
            // @ts-ignore
            LoggerProxy.logger.error(
              `Meeting:index#setUpLocusInfoMeetingListener --> DESTROY_MEETING. Issue with leave for meeting, meeting still in collection: ${this}, error: ${error}`
            );
          });
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
   * Truthy when a meeting has an audio connection established
   * @returns {Boolean}  true if meeting audio is connected otherwise false
   * @public
   * @memberof Meeting
   */
  public isAudioConnected() {
    return !!this.audio;
  }

  /**
   * Convenience function to tell whether a meeting is muted
   * @returns {Boolean} if meeting audio muted or not
   * @public
   * @memberof Meeting
   */
  public isAudioMuted() {
    return this.audio && this.audio.isMuted();
  }

  /**
   * Convenience function to tell if the end user last changed the audio state
   * @returns {Boolean} if audio was manipulated by the end user
   * @public
   * @memberof Meeting
   */
  public isAudioSelf() {
    return this.audio && this.audio.isSelf();
  }

  /**
   * Truthy when a meeting has a video connection established
   * @returns {Boolean} true if meeting video connected otherwise false
   * @public
   * @memberof Meeting
   */
  public isVideoConnected() {
    return !!this.video;
  }

  /**
   * Convenience function to tell whether video is muted
   * @returns {Boolean} if meeting video is muted or not
   * @public
   * @memberof Meeting
   */
  public isVideoMuted() {
    return this.video && this.video.isMuted();
  }

  /**
   * Convenience function to tell whether the end user changed the video state
   * @returns {Boolean} if meeting video is muted or not
   * @public
   * @memberof Meeting
   */
  public isVideoSelf() {
    return this.video && this.video.isSelf();
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
    }
  }

  /**
   * Sets the first locus info on the class instance
   * @param {Object} locus
   * @param {String} locus.url
   * @param {Array} locus.participants
   * @param {Object} locus.self
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private parseLocus(locus: {url: string; participants: Array<any>; self: object}) {
    if (locus) {
      this.locusUrl = locus.url;
      // TODO: move this to parse participants module
      this.setLocus(locus);

      // check if we can extract this info from partner
      // Parsing of locus object must be finished at this state
      if (locus.participants && locus.self) {
        this.partner = MeetingUtil.getLocusPartner(locus.participants, locus.self);
      }

      // For webex meeting the sipUrl gets updated in info parser
      if (!this.sipUri && this.partner && this.type === _CALL_) {
        this.setSipUri(this.partner.person.sipUrl || this.partner.person.id);
      }
    }
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
  private setLocus(
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
   * Removes remote audio and video stream on the class instance and triggers an event
   * to developers
   * @returns {undefined}
   * @public
   * @memberof Meeting
   * @deprecated after v1.89.3
   */
  public unsetRemoteStream() {
    LoggerProxy.logger.warn(
      'Meeting:index#unsetRemoteStream --> [DEPRECATION WARNING]: unsetRemoteStream has been deprecated after v1.89.3'
    );
    this.mediaProperties.unsetRemoteMedia();
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
   * Emits the 'media:ready' event with a local stream that consists of 1 local audio and 1 local video track
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private sendLocalMediaReadyEvent() {
    Trigger.trigger(
      this,
      {
        file: 'meeting/index',
        function: 'sendLocalMediaReadyEvent',
      },
      EVENT_TRIGGERS.MEDIA_READY,
      {
        type: EVENT_TYPES.LOCAL,
        stream: MediaUtil.createMediaStream([
          this.mediaProperties.audioTrack?.underlyingTrack,
          this.mediaProperties.videoTrack?.underlyingTrack,
        ]),
      }
    );
  }

  /**
   * Sets the local audio track on the class and emits an event to the developer
   * @param {MediaStreamTrack} rawAudioTrack
   * @param {Boolean} emitEvent if true, a media ready event is emitted to the developer
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setLocalAudioTrack(rawAudioTrack: MediaStreamTrack | null, emitEvent = true) {
    if (rawAudioTrack) {
      const settings = rawAudioTrack.getSettings();

      const localMicrophoneTrack = new LocalMicrophoneTrack(
        MediaUtil.createMediaStream([rawAudioTrack])
      );

      this.mediaProperties.setMediaSettings('audio', {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
      });

      LoggerProxy.logger.log(
        'Meeting:index#setLocalAudioTrack --> Audio settings.',
        JSON.stringify(this.mediaProperties.mediaSettings.audio)
      );
      this.mediaProperties.setLocalAudioTrack(localMicrophoneTrack);
      if (this.audio) this.audio.applyClientStateLocally(this);
    } else {
      this.mediaProperties.setLocalAudioTrack(null);
    }

    if (emitEvent) {
      this.sendLocalMediaReadyEvent();
    }
  }

  /**
   * Sets the local video track on the class and emits an event to the developer
   * @param {MediaStreamTrack} rawVideoTrack
   * @param {Boolean} emitEvent if true, a media ready event is emitted to the developer
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private setLocalVideoTrack(rawVideoTrack: MediaStreamTrack | null, emitEvent = true) {
    if (rawVideoTrack) {
      const {aspectRatio, frameRate, height, width, deviceId} = rawVideoTrack.getSettings();

      const {localQualityLevel} = this.mediaProperties;

      const localCameraTrack = new LocalCameraTrack(MediaUtil.createMediaStream([rawVideoTrack]));

      if (Number(localQualityLevel.slice(0, -1)) > height) {
        LoggerProxy.logger
          .warn(`Meeting:index#setLocalVideoTrack --> Local video quality of ${localQualityLevel} not supported,
         downscaling to highest possible resolution of ${height}p`);

        this.mediaProperties.setLocalQualityLevel(`${height}p`);
      }

      this.mediaProperties.setLocalVideoTrack(localCameraTrack);
      if (this.video) this.video.applyClientStateLocally(this);

      this.mediaProperties.setMediaSettings('video', {
        aspectRatio,
        frameRate,
        height,
        width,
      });
      // store and save the selected video input device
      if (deviceId) {
        this.mediaProperties.setVideoDeviceId(deviceId);
      }
      LoggerProxy.logger.log(
        'Meeting:index#setLocalVideoTrack --> Video settings.',
        JSON.stringify(this.mediaProperties.mediaSettings.video)
      );
    } else {
      this.mediaProperties.setLocalVideoTrack(null);
    }

    if (emitEvent) {
      this.sendLocalMediaReadyEvent();
    }
  }

  /**
   * Sets the local media stream on the class and emits an event to the developer
   * @param {Stream} localStream the local media stream
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public setLocalTracks(localStream: any) {
    if (localStream) {
      if (this.isMultistream) {
        throw new Error(
          'addMedia() and updateMedia() APIs are not supported with multistream, use publishTracks/unpublishTracks instead'
        );
      }

      const {audioTrack, videoTrack} = MeetingUtil.getTrack(localStream);

      this.setLocalAudioTrack(audioTrack, false);
      this.setLocalVideoTrack(videoTrack, false);

      this.sendLocalMediaReadyEvent();
    }
  }

  /**
   * Sets the local media stream on the class and emits an event to the developer
   * @param {MediaStreamTrack} rawLocalShareTrack the local share media track
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public setLocalShareTrack(rawLocalShareTrack: MediaStreamTrack | null) {
    if (rawLocalShareTrack) {
      const settings = rawLocalShareTrack.getSettings();

      const localDisplayTrack = new LocalDisplayTrack(
        MediaUtil.createMediaStream([rawLocalShareTrack])
      );

      this.mediaProperties.setLocalShareTrack(localDisplayTrack);

      this.mediaProperties.setMediaSettings('screen', {
        aspectRatio: settings.aspectRatio,
        frameRate: settings.frameRate,
        height: settings.height,
        width: settings.width,
        // @ts-ignore
        displaySurface: settings.displaySurface,
        // @ts-ignore
        cursor: settings.cursor,
      });
      LoggerProxy.logger.log(
        'Meeting:index#setLocalShareTrack --> Screen settings.',
        JSON.stringify(this.mediaProperties.mediaSettings.screen)
      );

      localDisplayTrack.on(LocalTrackEvents.Ended, this.handleShareTrackEnded);

      Trigger.trigger(
        this,
        {
          file: 'meeting/index',
          function: 'setLocalShareTrack',
        },
        EVENT_TRIGGERS.MEDIA_READY,
        {
          type: EVENT_TYPES.LOCAL_SHARE,
          track: rawLocalShareTrack,
        }
      );
    } else if (this.mediaProperties.shareTrack) {
      this.mediaProperties.shareTrack.off(LocalTrackEvents.Ended, this.handleShareTrackEnded);
      this.mediaProperties.shareTrack.stop(); // todo: this line should be removed once SPARK-399694 are SPARK-399695 are done
      this.mediaProperties.setLocalShareTrack(null);
    }
  }

  /**
   * Closes the local stream from the class and emits an event to the developer
   * @returns {undefined}
   * @event media:stopped
   * @public
   * @memberof Meeting
   */
  public closeLocalStream() {
    const {audioTrack, videoTrack} = this.mediaProperties;

    return Media.stopTracks(audioTrack)
      .then(() => Media.stopTracks(videoTrack))
      .then(() => {
        if (audioTrack || videoTrack) {
          Trigger.trigger(
            this,
            {
              file: 'meeting/index',
              function: 'closeLocalStream',
            },
            EVENT_TRIGGERS.MEDIA_STOPPED,
            {
              type: EVENT_TYPES.LOCAL,
            }
          );
        }
      });
  }

  /**
   * Closes the local stream from the class and emits an event to the developer
   * @returns {undefined}
   * @event media:stopped
   * @public
   * @memberof Meeting
   */
  public closeLocalShare() {
    const track = this.mediaProperties.shareTrack;

    return Media.stopTracks(track).then(() => {
      if (track) {
        Trigger.trigger(
          this,
          {
            file: 'meeting/index',
            function: 'closeLocalShare',
          },
          EVENT_TRIGGERS.MEDIA_STOPPED,
          {
            type: EVENT_TYPES.LOCAL_SHARE,
          }
        );
      }
    });
  }

  /**
   * Removes the local stream from the class and emits an event to the developer
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public unsetLocalVideoTrack() {
    this.mediaProperties.unsetLocalVideoTrack();
  }

  /**
   * Removes the local share from the class and emits an event to the developer
   * @returns {undefined}
   * @public
   * @memberof Meeting
   */
  public unsetLocalShareTrack() {
    this.mediaProperties.unsetLocalShareTrack();
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
        Metrics.postEvent({
          event: eventType.MERCURY_CONNECTION_RESTORED,
          meeting: this,
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
      Metrics.postEvent({
        event: eventType.MERCURY_CONNECTION_LOST,
        meeting: this,
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

    const LOG_HEADER = 'Meeting:index#muteAudio -->';

    // First, stop sending the local audio media
    return logRequest(
      this.audio
        .handleClientRequest(this, true)
        .then(() => {
          MeetingUtil.handleAudioLogging(this.mediaProperties.audioTrack);
          Metrics.postEvent({
            event: eventType.MUTED,
            meeting: this,
            data: {trigger: trigger.USER_INTERACTION, mediaType: mediaType.AUDIO},
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
        header: `${LOG_HEADER} muting audio`,
        success: `${LOG_HEADER} muted audio successfully`,
        failure: `${LOG_HEADER} muting audio failed, `,
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

    const LOG_HEADER = 'Meeting:index#unmuteAudio -->';

    // First, send the control to unmute the participant on the server
    return logRequest(
      this.audio
        .handleClientRequest(this, false)
        .then(() => {
          MeetingUtil.handleAudioLogging(this.mediaProperties.audioTrack);
          Metrics.postEvent({
            event: eventType.UNMUTED,
            meeting: this,
            data: {trigger: trigger.USER_INTERACTION, mediaType: mediaType.AUDIO},
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
        header: `${LOG_HEADER} unmuting audio`,
        success: `${LOG_HEADER} unmuted audio successfully`,
        failure: `${LOG_HEADER} unmuting audio failed, `,
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

    const LOG_HEADER = 'Meeting:index#muteVideo -->';

    return logRequest(
      this.video
        .handleClientRequest(this, true)
        .then(() => {
          MeetingUtil.handleVideoLogging(this.mediaProperties.videoTrack);
          Metrics.postEvent({
            event: eventType.MUTED,
            meeting: this,
            data: {trigger: trigger.USER_INTERACTION, mediaType: mediaType.VIDEO},
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
        header: `${LOG_HEADER} muting video`,
        success: `${LOG_HEADER} muted video successfully`,
        failure: `${LOG_HEADER} muting video failed, `,
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

    const LOG_HEADER = 'Meeting:index#unmuteVideo -->';

    return logRequest(
      this.video
        .handleClientRequest(this, false)
        .then(() => {
          MeetingUtil.handleVideoLogging(this.mediaProperties.videoTrack);
          Metrics.postEvent({
            event: eventType.UNMUTED,
            meeting: this,
            data: {trigger: trigger.USER_INTERACTION, mediaType: mediaType.VIDEO},
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
        header: `${LOG_HEADER} unmuting video`,
        success: `${LOG_HEADER} unmuted video successfully`,
        failure: `${LOG_HEADER} unmuting video failed, `,
      }
    );
  }

  /**
   * Shorthand function to join AND set up media
   * @param {Object} options - options to join with media
   * @param {JoinOptions} [options.joinOptions] - see #join()
   * @param {MediaDirection} options.mediaSettings - see #addMedia()
   * @param {AudioVideo} [options.audioVideoOptions] - see #getMediaStreams()
   * @returns {Promise} -- {join: see join(), media: see addMedia(), local: see getMediaStreams()}
   * @public
   * @memberof Meeting
   * @example
   * joinWithMedia({
   *  joinOptions: {resourceId: 'resourceId' },
   *  mediaSettings: {
   *   sendAudio: true,
   *   sendVideo: true,
   *   sendShare: false,
   *   receiveVideo:true,
   *   receiveAudio: true,
   *   receiveShare: true
   * }
   * audioVideoOptions: {
   *   audio: 'audioDeviceId',
   *   video: 'videoDeviceId'
   * }})
   */
  public joinWithMedia(
    options: {
      joinOptions?: any;
      mediaSettings: any;
      audioVideoOptions?: any;
    } = {} as any
  ) {
    // TODO: add validations for parameters
    const {mediaSettings, joinOptions, audioVideoOptions} = options;

    return this.join(joinOptions)
      .then((joinResponse) =>
        this.getMediaStreams(mediaSettings, audioVideoOptions).then(([localStream, localShare]) =>
          this.addMedia({
            mediaSettings,
            localShare,
            localStream,
          }).then((mediaResponse) => ({
            join: joinResponse,
            media: mediaResponse,
            local: [localStream, localShare],
          }))
        )
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

    if (!this.hasJoinedOnce) {
      this.hasJoinedOnce = true;
    } else {
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

    Metrics.postEvent({
      event: eventType.CALL_INITIATED,
      meeting: this,
      data: {trigger: trigger.USER_INTERACTION, isRoapCallEnabled: true},
    });

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

        this.mediaProperties.setLocalQualityLevel(options.meetingQuality);
        this.mediaProperties.setRemoteQualityLevel(options.meetingQuality);
      }

      if (typeof options.meetingQuality === 'object') {
        if (
          !QUALITY_LEVELS[options.meetingQuality.local] &&
          !QUALITY_LEVELS[options.meetingQuality.remote]
        ) {
          const errorMessage = `Meeting:index#join --> ${
            options.meetingQuality.local || options.meetingQuality.remote
          } not defined`;

          LoggerProxy.logger.error(errorMessage);

          const error = new Error(errorMessage);

          joinFailed(error);
          this.deferJoin = undefined;

          return Promise.reject(new Error(errorMessage));
        }

        if (options.meetingQuality.local) {
          this.mediaProperties.setLocalQualityLevel(options.meetingQuality.local);
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
          // @ts-ignore - Fix type
          this.webex.internal.llm.on('event:relay.event', this.processRelayEvent);
          LoggerProxy.logger.info('Meeting:index#join --> enabled to receive relay events!');
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

        Metrics.postEvent({
          event: eventType.LOCUS_JOIN_RESPONSE,
          meeting: this,
          meetingId: this.id,
          data: {
            errors: [Metrics.parseLocusError(error.error, true)],
          },
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

    const isJoined = this.joinedWith && this.joinedWith.state === 'JOINED';

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
    return this.webex.internal.llm.registerAndConnect(url, datachannelUrl);
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
        .then((res) => {
          this.locusInfo.onFullLocus(res.body.locus);
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
        .then((res) => {
          this.locusInfo.onFullLocus(res.body.locus);
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

    Metrics.postEvent({
      event: eventType.MEDIA_CAPABILITIES,
      meeting: this,
      data: {
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
    });

    Metrics.postEvent({event: eventType.MOVE_MEDIA, meeting: this});

    this.locusInfo.once(LOCUSINFO.EVENTS.SELF_OBSERVING, async () => {
      // Clean up the camera , microphone track and re initiate it

      try {
        if (this.isSharing) {
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

        // clean up the local tracks
        this.mediaProperties.setMediaDirection(mediaSettings.mediaDirection);

        // close the existing local tracks
        await this.closeLocalStream();
        await this.closeLocalShare();

        this.mediaProperties.unsetMediaTracks();

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

    Metrics.postEvent({event: eventType.MOVE_MEDIA, meeting: this});

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
   * Get local media streams based on options passed
   *
   * NOTE: this method can only be used with transcoded meetings, not with multistream meetings
   *
   * @param {MediaDirection} mediaDirection A configurable options object for joining a meeting
   * @param {AudioVideo} [audioVideo] audio/video object to set audioinput and videoinput devices, see #Media.getUserMedia
   * @param {SharePreferences} [sharePreferences] audio/video object to set audioinput and videoinput devices, see #Media.getUserMedia
   * @returns {Promise} see #Media.getUserMedia
   * @public
   * @todo should be static, or moved so can be called outside of a meeting
   * @memberof Meeting
   */
  getMediaStreams = (
    mediaDirection: any,
    // This return an OBJECT {video: {height, widght}}
    // eslint-disable-next-line default-param-last
    audioVideo: any = VIDEO_RESOLUTIONS[this.mediaProperties.localQualityLevel],
    sharePreferences?: any
  ) => {
    if (
      mediaDirection &&
      (mediaDirection.sendAudio || mediaDirection.sendVideo || mediaDirection.sendShare)
    ) {
      if (
        mediaDirection &&
        mediaDirection.sendAudio &&
        mediaDirection.sendVideo &&
        mediaDirection.sendShare &&
        isBrowser('safari')
      ) {
        LoggerProxy.logger.warn(
          'Meeting:index#getMediaStreams --> Setting `sendShare` to FALSE, due to complications with Safari'
        );

        mediaDirection.sendShare = false;

        LoggerProxy.logger.warn(
          'Meeting:index#getMediaStreams --> Enabling `sendShare` along with `sendAudio` & `sendVideo`, on Safari, causes a failure while setting up a screen share at the same time as the camera+mic stream'
        );
        LoggerProxy.logger.warn(
          'Meeting:index#getMediaStreams --> Please use `meeting.shareScreen()` to manually start the screen share after successfully joining the meeting'
        );
      }

      if (audioVideo && isString(audioVideo)) {
        if (Object.keys(VIDEO_RESOLUTIONS).includes(audioVideo)) {
          this.mediaProperties.setLocalQualityLevel(audioVideo);
          audioVideo = {video: VIDEO_RESOLUTIONS[audioVideo].video};
        } else {
          throw new ParameterError(
            `${audioVideo} not supported. Either pass level from pre-defined resolutions or pass complete audioVideo object`
          );
        }
      }

      if (!audioVideo.video) {
        audioVideo = {
          ...audioVideo,
          video: {
            ...audioVideo.video,
            ...VIDEO_RESOLUTIONS[this.mediaProperties.localQualityLevel].video,
          },
        };
      }
      // extract deviceId if exists otherwise default to null.
      const {deviceId: preferredVideoDevice} = (audioVideo && audioVideo.video) || {deviceId: null};
      const lastVideoDeviceId = this.mediaProperties.getVideoDeviceId();

      if (preferredVideoDevice) {
        // Store new preferred video input device
        this.mediaProperties.setVideoDeviceId(preferredVideoDevice);
      } else if (lastVideoDeviceId) {
        // no new video preference specified so use last stored value,
        // works with empty object {} or media constraint.
        // eslint-disable-next-line no-param-reassign
        audioVideo = {
          ...audioVideo,
          video: {
            ...audioVideo.video,
            deviceId: lastVideoDeviceId,
          },
        };
      }

      return Media.getSupportedDevice({
        sendAudio: mediaDirection.sendAudio,
        sendVideo: mediaDirection.sendVideo,
      })
        .catch((error) =>
          Promise.reject(
            new MediaError(
              'Given constraints do not match permission set for either camera or microphone',
              error
            )
          )
        )
        .then((devicePermissions) =>
          Media.getUserMedia(
            {
              ...mediaDirection,
              sendAudio: devicePermissions.sendAudio,
              sendVideo: devicePermissions.sendVideo,
              isSharing: this.shareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE,
            },
            audioVideo,
            sharePreferences,
            // @ts-ignore - config coming from registerPlugin
            this.config
          ).catch((error) => {
            // Whenever there is a failure when trying to access a user's device
            // report it as an Behavioral metric
            // This gives visibility into common errors and can help
            // with further troubleshooting
            const metricName = BEHAVIORAL_METRICS.GET_USER_MEDIA_FAILURE;
            const data = {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl?.split('/').pop(),
              reason: error.message,
              stack: error.stack,
            };
            const metadata = {
              type: error.name,
            };

            Metrics.sendBehavioralMetric(metricName, data, metadata);
            throw new MediaError('Unable to retrieve media streams', error);
          })
        );
    }

    return Promise.reject(
      new MediaError('At least one of the mediaDirection value should be true')
    );
  };

  /**
   * Checks if the machine has at least one audio or video device
   * @param {Object} options
   * @param {Boolean} options.sendAudio
   * @param {Boolean} options.sendVideo
   * @returns {Object}
   * @memberof Meetings
   */
  getSupportedDevices = ({
    sendAudio = true,
    sendVideo = true,
  }: {
    sendAudio: boolean;
    sendVideo: boolean;
  }) => Media.getSupportedDevice({sendAudio, sendVideo});

  /**
   * Get the devices from the Media module
   * @returns {Promise} resolves to an array of DeviceInfo
   * @memberof Meetings
   */
  getDevices = () => Media.getDevices();

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
      sendBehavioralMetric(BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE, error, this.id);

      Metrics.postEvent({
        event: eventType.LOCAL_SDP_GENERATED,
        meetingId: this.id,
        data: {
          canProceed: false,
          errors: [
            Metrics.generateErrorPayload(2001, true, MetricsError.name.MEDIA_ENGINE, undefined),
          ],
        },
      });
    } else if (
      error instanceof Errors.SdpOfferHandlingError ||
      error instanceof Errors.SdpAnswerHandlingError
    ) {
      sendBehavioralMetric(BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE, error, this.id);

      Metrics.postEvent({
        event: eventType.REMOTE_SDP_RECEIVED,
        meetingId: this.id,
        data: {
          canProceed: false,
          errors: [
            Metrics.generateErrorPayload(2001, true, MetricsError.name.MEDIA_ENGINE, undefined),
          ],
        },
      });
    } else if (error instanceof Errors.SdpError) {
      // this covers also the case of Errors.IceGatheringError which extends Errors.SdpError
      sendBehavioralMetric(BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE, error, this.id);

      Metrics.postEvent({
        event: eventType.LOCAL_SDP_GENERATED,
        meetingId: this.id,
        data: {
          canProceed: false,
          errors: [
            Metrics.generateErrorPayload(2001, true, MetricsError.name.MEDIA_ENGINE, undefined),
          ],
        },
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
      const LOG_HEADER = 'Meeting:index#setupMediaConnectionListeners.ROAP_MESSAGE_TO_SEND -->';

      switch (event.roapMessage.messageType) {
        case 'OK':
          Metrics.postEvent({
            event: eventType.REMOTE_SDP_RECEIVED,
            meetingId: this.id,
          });

          logRequest(
            this.roap.sendRoapOK({
              seq: event.roapMessage.seq,
              mediaId: this.mediaId,
              correlationId: this.correlationId,
            }),
            {
              header: `${LOG_HEADER} Send Roap OK`,
              success: `${LOG_HEADER} Successfully send roap OK`,
              failure: `${LOG_HEADER} Error joining the call on send roap OK, `,
            }
          );
          break;

        case 'OFFER':
          Metrics.postEvent({
            event: eventType.LOCAL_SDP_GENERATED,
            meetingId: this.id,
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
              header: `${LOG_HEADER} Send Roap Offer`,
              success: `${LOG_HEADER} Successfully send roap offer`,
              failure: `${LOG_HEADER} Error joining the call on send roap offer, `,
            }
          );
          break;

        case 'ANSWER':
          Metrics.postEvent({
            event: eventType.REMOTE_SDP_RECEIVED,
            meetingId: this.id,
          });

          logRequest(
            this.roap.sendRoapAnswer({
              sdp: event.roapMessage.sdp,
              seq: event.roapMessage.seq,
              mediaId: this.mediaId,
              correlationId: this.correlationId,
            }),
            {
              header: `${LOG_HEADER} Send Roap Answer.`,
              success: `${LOG_HEADER} Successfully send roap answer`,
              failure: `${LOG_HEADER} Error joining the call on send roap answer, `,
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
              header: `${LOG_HEADER} Send Roap Error.`,
              success: `${LOG_HEADER} Successfully send roap error`,
              failure: `${LOG_HEADER} Failed to send roap error, `,
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
        Metrics.postEvent({
          event: eventType.ICE_END,
          meeting: this,
          data: {
            canProceed: false,
            errors: [
              Metrics.generateErrorPayload(2004, false, MetricsError.name.MEDIA_ENGINE, undefined),
            ],
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
        `Meeting:index#setupMediaConnectionListeners --> connection state changed to ${event.state}`
      );
      switch (event.state) {
        case ConnectionState.Connecting:
          Metrics.postEvent({event: eventType.ICE_START, meeting: this});
          break;
        case ConnectionState.Connected:
          Metrics.postEvent({event: eventType.ICE_END, meeting: this});
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
      Metrics.postEvent({
        event: eventType.MEDIA_QUALITY,
        meeting: this,
        data: {intervalData: options.data, networkType: options.networkType},
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
      Metrics.postEvent({
        event: eventType.SENDING_MEDIA_START,
        meeting: this,
        data: {
          mediaType: data.type,
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.LOCAL_MEDIA_STOPPED, (data) => {
      Metrics.postEvent({
        event: eventType.SENDING_MEDIA_STOP,
        meeting: this,
        data: {
          mediaType: data.type,
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
      Metrics.postEvent({
        event: eventType.RECEIVING_MEDIA_START,
        meeting: this,
        data: {
          mediaType: data.type,
        },
      });
    });
    this.statsAnalyzer.on(StatsAnalyzerEvents.REMOTE_MEDIA_STOPPED, (data) => {
      Metrics.postEvent({
        event: eventType.RECEIVING_MEDIA_STOP,
        meeting: this,
        data: {
          mediaType: data.type,
        },
      });
    });
  };

  getMediaConnectionDebugId() {
    return `MC-${this.id.substring(0, 4)}`;
  }

  /**
   * Creates a webrtc media connection
   *
   * @param {Object} turnServerInfo TURN server information
   * @returns {RoapMediaConnection | MultistreamRoapMediaConnection}
   */
  createMediaConnection(turnServerInfo) {
    const mc = Media.createMediaConnection(this.isMultistream, this.getMediaConnectionDebugId(), {
      mediaProperties: this.mediaProperties,
      remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
      // @ts-ignore - config coming from registerPlugin
      enableRtx: this.config.enableRtx,
      // @ts-ignore - config coming from registerPlugin
      enableExtmap: this.config.enableExtmap,
      turnServerInfo,
    });

    this.mediaProperties.setMediaPeerConnection(mc);
    this.setupMediaConnectionListeners();

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
   * Specify joining via audio (option: pstn), video, screenshare
   * @param {Object} options A configurable options object for joining a meeting
   * @param {Object} options.resourceId pass the deviceId
   * @param {MediaDirection} options.mediaSettings pass media options
   * @param {MediaStream} options.localStream
   * @param {MediaStream} options.localShare
   * @param {RemoteMediaManagerConfig} options.remoteMediaManagerConfig only applies if multistream is enabled
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  addMedia(options: any = {}) {
    const LOG_HEADER = 'Meeting:index#addMedia -->';

    let turnDiscoverySkippedReason;
    let turnServerUsed = false;

    if (this.meetingState !== FULL_STATE.ACTIVE) {
      return Promise.reject(new MeetingNotActiveError());
    }

    if (MeetingUtil.isUserInLeftState(this.locusInfo)) {
      return Promise.reject(new UserNotJoinedError());
    }
    // If the user is unjoined or guest waiting in lobby dont allow the user to addMedia
    // @ts-ignore - isUserUnadmitted coming from SelfUtil
    if (this.isUserUnadmitted && !this.wirelessShare) {
      return Promise.reject(new UserInLobbyError());
    }

    const {localStream, localShare, mediaSettings, remoteMediaManagerConfig} = options;

    LoggerProxy.logger.info(`${LOG_HEADER} Adding Media.`);

    Metrics.postEvent({
      event: eventType.MEDIA_CAPABILITIES,
      meeting: this,
      data: {
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
    });

    return MeetingUtil.validateOptions(options)
      .then(() => this.roap.doTurnDiscovery(this, false))
      .then((turnDiscoveryObject) => {
        ({turnDiscoverySkippedReason} = turnDiscoveryObject);
        turnServerUsed = !turnDiscoverySkippedReason;

        const {turnServerInfo} = turnDiscoveryObject;

        this.preMedia(localStream, localShare, mediaSettings);

        const mc = this.createMediaConnection(turnServerInfo);

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

          return this.remoteMediaManager.start().then(() => mc.initiateOffer());
        }

        return mc.initiateOffer();
      })
      .then(() => {
        this.setMercuryListener();
      })
      .then(() =>
        this.getDevices().then((devices) => {
          MeetingUtil.handleDeviceLogging(devices);
        })
      )
      .then(() => {
        this.handleMediaLogging(this.mediaProperties);
        LoggerProxy.logger.info(`${LOG_HEADER} media connection created`);

        // @ts-ignore - config coming from registerPlugin
        if (this.config.stats.enableStatsAnalyzer) {
          // @ts-ignore - config coming from registerPlugin
          this.networkQualityMonitor = new NetworkQualityMonitor(this.config.stats);
          // @ts-ignore - config coming from registerPlugin
          this.statsAnalyzer = new StatsAnalyzer(this.config.stats, this.networkQualityMonitor);
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
            if (this.type === _CALL_) {
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
          throw new Error(
            `Timed out waiting for media connection to be connected, correlationId=${this.correlationId}`
          );
        })
      )
      .then(() => {
        LoggerProxy.logger.info(`${LOG_HEADER} PeerConnection CONNECTED`);
        if (mediaSettings && mediaSettings.sendShare && localShare) {
          if (this.state === MEETING_STATE.STATES.JOINED) {
            return this.requestScreenShareFloor();
          }

          // When the self state changes to JOINED then request the floor
          this.floorGrantPending = true;
        }

        return {};
      })
      .then(() => this.mediaProperties.getCurrentConnectionType())
      .then((connectionType) => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_MEDIA_SUCCESS, {
          correlation_id: this.correlationId,
          locus_id: this.locusUrl.split('/').pop(),
          connectionType,
        });
      })
      .catch((error) => {
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

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE, {
            correlation_id: this.correlationId,
            locus_id: this.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
            code: error.code,
            turnDiscoverySkippedReason,
            turnServerUsed,
          });

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
  private enqueueMediaUpdate(mediaUpdateType: string, options: any) {
    if (mediaUpdateType === MEDIA_UPDATE_TYPE.LAMBDA && typeof options?.lambda !== 'function') {
      return Promise.reject(
        new Error('lambda must be specified when enqueuing MEDIA_UPDATE_TYPE.LAMBDA')
      );
    }
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
      switch (mediaUpdateType) {
        case MEDIA_UPDATE_TYPE.ALL:
          this.updateMedia(options).then(pendingPromiseResolve, pendingPromiseReject);
          break;
        case MEDIA_UPDATE_TYPE.AUDIO:
          this.updateAudio(options).then(pendingPromiseResolve, pendingPromiseReject);
          break;
        case MEDIA_UPDATE_TYPE.VIDEO:
          this.updateVideo(options).then(pendingPromiseResolve, pendingPromiseReject);
          break;
        case MEDIA_UPDATE_TYPE.SHARE:
          this.updateShare(options).then(pendingPromiseResolve, pendingPromiseReject);
          break;
        case MEDIA_UPDATE_TYPE.LAMBDA:
          options.lambda().then(pendingPromiseResolve, pendingPromiseReject);
          break;
        default:
          LoggerProxy.logger.error(
            `Peer-connection-manager:index#processNextQueuedMediaUpdate --> unsupported media update type ${mediaUpdateType} found in the queue`
          );
          break;
      }
    }
  };

  /**
   * A confluence of updateAudio, updateVideo, and updateShare
   * this function re-establishes all of the media streams with new options
   * @param {Object} options
   * @param {MediaStream} options.localStream
   * @param {MediaStream} options.localShare
   * @param {MediaDirection} options.mediaSettings
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public updateMedia(
    options: {
      localStream?: MediaStream;
      localShare?: MediaStream;
      mediaSettings?: any;
    } = {} as any
  ) {
    const LOG_HEADER = 'Meeting:index#updateMedia -->';

    if (this.isMultistream) {
      throw new Error(
        'updateMedia() is not supported with multistream, use publishTracks/unpublishTracks instead'
      );
    }
    if (!this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.ALL, options);
    }
    const {localStream, localShare, mediaSettings} = options;

    const previousSendShareStatus = this.mediaProperties.mediaDirection.sendShare;

    if (!this.mediaProperties.webrtcMediaConnection) {
      return Promise.reject(new Error('media connection not established, call addMedia() first'));
    }

    return MeetingUtil.validateOptions(options)
      .then(() => this.preMedia(localStream, localShare, mediaSettings))
      .then(() =>
        this.mediaProperties.webrtcMediaConnection
          .updateSendReceiveOptions({
            send: {
              audio: this.mediaProperties.mediaDirection.sendAudio
                ? this.mediaProperties.audioTrack.underlyingTrack
                : null,
              video: this.mediaProperties.mediaDirection.sendVideo
                ? this.mediaProperties.videoTrack.underlyingTrack
                : null,
              screenShareVideo: this.mediaProperties.mediaDirection.sendShare
                ? this.mediaProperties.shareTrack.underlyingTrack
                : null,
            },
            receive: {
              audio: this.mediaProperties.mediaDirection.receiveAudio,
              video: this.mediaProperties.mediaDirection.receiveVideo,
              screenShareVideo: this.mediaProperties.mediaDirection.receiveShare,
              remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
            },
          })
          .then(() => {
            LoggerProxy.logger.info(
              `${LOG_HEADER} webrtcMediaConnection.updateSendReceiveOptions done`
            );
          })
          .catch((error) => {
            LoggerProxy.logger.error(`${LOG_HEADER} Error updatedMedia, `, error);

            Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UPDATE_MEDIA_FAILURE, {
              correlation_id: this.correlationId,
              locus_id: this.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
            });

            throw error;
          })
          // todo: the following code used to be called always after sending the roap message with the new SDP
          // now it's called independently from the roap message (so might be before it), check if that's OK
          // if not, ensure it's called after (now it's called after roap message is sent out, but we're not
          // waiting for sendRoapMediaRequest() to be resolved)
          .then(() =>
            this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.LAMBDA, {
              lambda: () => {
                return Promise.resolve()
                  .then(() =>
                    this.checkForStopShare(mediaSettings.sendShare, previousSendShareStatus)
                  )
                  .then((startShare) => {
                    // This is a special case if we do an /floor grant followed by /media
                    // we actually get a OFFER from the server and a GLAR condition happens
                    if (startShare) {
                      // We are assuming that the clients are connected when doing an update
                      return this.requestScreenShareFloor();
                    }

                    return Promise.resolve();
                  });
              },
            })
          )
      );
  }

  /**
   * Update the main audio track with new parameters
   *
   * NOTE: this method can only be used with transcoded meetings, for multistream meetings use publishTrack()
   *
   * @param {Object} options
   * @param {boolean} options.sendAudio
   * @param {boolean} options.receiveAudio
   * @param {MediaStream} options.stream Stream that contains the audio track to update
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public async updateAudio(options: {
    sendAudio: boolean;
    receiveAudio: boolean;
    stream: MediaStream;
  }) {
    if (this.isMultistream) {
      throw new Error(
        'updateAudio() is not supported with multistream, use publishTracks/unpublishTracks instead'
      );
    }
    if (!this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.AUDIO, options);
    }
    const {sendAudio, receiveAudio, stream} = options;
    const track = MeetingUtil.getTrack(stream).audioTrack;

    if (typeof sendAudio !== 'boolean' || typeof receiveAudio !== 'boolean') {
      return Promise.reject(new ParameterError('Pass sendAudio and receiveAudio parameter'));
    }

    if (!this.mediaProperties.webrtcMediaConnection) {
      return Promise.reject(new Error('media connection not established, call addMedia() first'));
    }

    return MeetingUtil.validateOptions({sendAudio, localStream: stream})
      .then(() =>
        this.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions({
          send: {audio: track},
          receive: {
            audio: options.receiveAudio,
            video: this.mediaProperties.mediaDirection.receiveVideo,
            screenShareVideo: this.mediaProperties.mediaDirection.receiveShare,
            remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
          },
        })
      )
      .then(() => {
        this.setLocalAudioTrack(track);
        // todo: maybe this.mediaProperties.mediaDirection could be removed? it's duplicating stuff from webrtcMediaConnection
        this.mediaProperties.mediaDirection.sendAudio = sendAudio;
        this.mediaProperties.mediaDirection.receiveAudio = receiveAudio;

        // audio state could be undefined if you have not sent audio before
        this.audio =
          this.audio || createMuteState(AUDIO, this, this.mediaProperties.mediaDirection);
      });
  }

  /**
   * Update the main video track with new parameters
   *
   * NOTE: this method can only be used with transcoded meetings, for multistream meetings use publishTrack()
   *
   * @param {Object} options
   * @param {boolean} options.sendVideo
   * @param {boolean} options.receiveVideo
   * @param {MediaStream} options.stream Stream that contains the video track to update
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public updateVideo(options: {sendVideo: boolean; receiveVideo: boolean; stream: MediaStream}) {
    if (this.isMultistream) {
      throw new Error(
        'updateVideo() is not supported with multistream, use publishTracks/unpublishTracks instead'
      );
    }
    if (!this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.VIDEO, options);
    }
    const {sendVideo, receiveVideo, stream} = options;
    const track = MeetingUtil.getTrack(stream).videoTrack;

    if (typeof sendVideo !== 'boolean' || typeof receiveVideo !== 'boolean') {
      return Promise.reject(new ParameterError('Pass sendVideo and receiveVideo parameter'));
    }

    if (!this.mediaProperties.webrtcMediaConnection) {
      return Promise.reject(new Error('media connection not established, call addMedia() first'));
    }

    return MeetingUtil.validateOptions({sendVideo, localStream: stream})
      .then(() =>
        this.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions({
          send: {video: track},
          receive: {
            audio: this.mediaProperties.mediaDirection.receiveAudio,
            video: options.receiveVideo,
            screenShareVideo: this.mediaProperties.mediaDirection.receiveShare,
            remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
          },
        })
      )
      .then(() => {
        this.setLocalVideoTrack(track);
        this.mediaProperties.mediaDirection.sendVideo = sendVideo;
        this.mediaProperties.mediaDirection.receiveVideo = receiveVideo;

        // video state could be undefined if you have not sent video before
        this.video =
          this.video || createMuteState(VIDEO, this, this.mediaProperties.mediaDirection);
      });
  }

  /**
   * Internal function when stopping a share stream, cleanup
   * @param {boolean} sendShare
   * @param {boolean} previousShareStatus
   * @returns {Promise}
   * @private
   * @memberof Meeting
   */
  private checkForStopShare(sendShare: boolean, previousShareStatus: boolean) {
    if (sendShare && !previousShareStatus) {
      // When user starts sharing
      return Promise.resolve(true);
    }

    if (!sendShare && previousShareStatus) {
      // When user stops sharing
      return this.releaseScreenShareFloor().then(() => Promise.resolve(false));
    }

    return Promise.resolve();
  }

  /**
   * Update the share streams, can be used to start sharing
   *
   * NOTE: this method can only be used with transcoded meetings, for multistream meetings use publishTrack()
   *
   * @param {Object} options
   * @param {boolean} options.sendShare
   * @param {boolean} options.receiveShare
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public updateShare(options: {
    sendShare?: boolean;
    receiveShare?: boolean;
    stream?: any;
    skipSignalingCheck?: boolean;
  }) {
    if (this.isMultistream) {
      throw new Error(
        'updateShare() is not supported with multistream, use publishTracks/unpublishTracks instead'
      );
    }
    if (!options.skipSignalingCheck && !this.canUpdateMedia()) {
      return this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.SHARE, options);
    }
    const {sendShare, receiveShare, stream} = options;
    const track = MeetingUtil.getTrack(stream).videoTrack;

    if (typeof sendShare !== 'boolean' || typeof receiveShare !== 'boolean') {
      return Promise.reject(new ParameterError('Pass sendShare and receiveShare parameter'));
    }

    if (!this.mediaProperties.webrtcMediaConnection) {
      return Promise.reject(new Error('media connection not established, call addMedia() first'));
    }

    const previousSendShareStatus = this.mediaProperties.mediaDirection.sendShare;

    this.setLocalShareTrack(track);

    return MeetingUtil.validateOptions({sendShare, localShare: stream})
      .then(() => this.checkForStopShare(sendShare, previousSendShareStatus))
      .then((startShare) =>
        this.mediaProperties.webrtcMediaConnection
          .updateSendReceiveOptions({
            send: {screenShareVideo: track},
            receive: {
              audio: this.mediaProperties.mediaDirection.receiveAudio,
              video: this.mediaProperties.mediaDirection.receiveVideo,
              screenShareVideo: options.receiveShare,
              remoteQualityLevel: this.mediaProperties.remoteQualityLevel,
            },
          })
          .then(() =>
            this.enqueueMediaUpdate(MEDIA_UPDATE_TYPE.LAMBDA, {
              lambda: async () => {
                if (startShare) {
                  return this.requestScreenShareFloor();
                }

                return undefined;
              },
            })
          )
      )
      .then(() => {
        this.mediaProperties.mediaDirection.sendShare = sendShare;
        this.mediaProperties.mediaDirection.receiveShare = receiveShare;
      })
      .catch((error) => {
        this.unsetLocalShareTrack();
        throw error;
      });
  }

  /**
   * Do all the attach media pre set up before executing the actual attach
   * @param {MediaStream} localStream
   * @param {MediaStream} localShare
   * @param {MediaDirection} mediaSettings
   * @returns {undefined}
   * @private
   * @memberof Meeting
   */
  private preMedia(localStream: MediaStream, localShare: MediaStream, mediaSettings: any) {
    // eslint-disable-next-line no-warning-comments
    // TODO wire into default config. There's currently an issue with the stateless plugin or how we register
    // @ts-ignore - config coming from registerPlugin
    this.mediaProperties.setMediaDirection(Object.assign(this.config.mediaSettings, mediaSettings));
    // add a setup a function move the create and setup media in future
    // TODO: delete old audio and video if stale
    this.audio = this.audio || createMuteState(AUDIO, this, this.mediaProperties.mediaDirection);
    this.video = this.video || createMuteState(VIDEO, this, this.mediaProperties.mediaDirection);
    // Validation is already done in addMedia so no need to check if the lenght is greater then 0
    this.setLocalTracks(localStream);
    if (this.isMultistream && localShare) {
      throw new Error(
        'calling addMedia() with localShare stream is not supported when using multistream'
      );
    }
    this.setLocalShareTrack(MeetingUtil.getTrack(localShare).videoTrack);
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
          Metrics.postEvent({event: eventType.ALERT_DISPLAYED, meeting: this});

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
    Metrics.postEvent({
      event: eventType.LEAVE,
      meeting: this,
      data: {trigger: trigger.USER_INTERACTION, canProceed: false},
    });
    const leaveReason = options.reason || MEETING_REMOVED_REASON.CLIENT_LEAVE_REQUEST;

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
      Metrics.postEvent({event: eventType.WHITEBOARD_SHARE_INITIATED, meeting: this});

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
          this.isSharing = false;

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
      Metrics.postEvent({event: eventType.WHITEBOARD_SHARE_STOPPED, meeting: this});

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
    const content = this.locusInfo.mediaShares.find((element) => element.name === CONTENT);

    if (content && this.shareStatus !== SHARE_STATUS.LOCAL_SHARE_ACTIVE) {
      Metrics.postEvent({event: eventType.SHARE_INITIATED, meeting: this});

      return this.meetingRequest
        .changeMeetingFloor({
          disposition: FLOOR_ACTION.GRANTED,
          personUrl: this.locusInfo.self.url,
          deviceUrl: this.deviceUrl,
          uri: content.url,
          resourceUrl: this.resourceUrl,
        })
        .then(() => {
          this.isSharing = true;

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

          return Promise.reject(error);
        });
    }

    return Promise.reject(new ParameterError('Cannot share without content.'));
  }

  /**
   * Stops the screen share
   * @returns {Promise} see #updateShare
   * @public
   * @memberof Meeting
   */
  // Internal only, temporarily allows optional params
  // eslint-disable-next-line valid-jsdoc
  public stopShare(options = {}) {
    return this.updateShare({
      sendShare: false,
      receiveShare: this.mediaProperties.mediaDirection.receiveShare,
      ...options,
    });
  }

  /**
   * Sends a request to Locus to release the screen share floor.
   * @returns {Promise} see #meetingRequest.changeMeetingFloor
   * @private
   * @memberof Meeting
   */
  private releaseScreenShareFloor() {
    const content = this.locusInfo.mediaShares.find((element) => element.name === CONTENT);

    if (content && this.mediaProperties.mediaDirection.sendShare) {
      Metrics.postEvent({event: eventType.SHARE_STOPPED, meeting: this});

      if (content.floor.beneficiary.id !== this.selfId) {
        // remote participant started sharing and caused our sharing to stop, we don't want to send any floor action request in that case
        this.isSharing = false;

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
        })
        .finally(() => {
          this.isSharing = false;
        });
    }

    return Promise.reject(new ParameterError('Cannot stop share without content'));
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
      .then((response) => {
        if (response && response.body && response.body.locus) {
          this.locusInfo.onFullLocus(response.body.locus);
        }
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:index#changeVideoLayout --> Error ', error);

        return Promise.reject(error);
      });
  }

  /**
   * Sets the quality of the local video stream
   * @param {String} level {LOW|MEDIUM|HIGH}
   * @returns {Promise<MediaStream>} localStream
   */
  setLocalVideoQuality(level: string) {
    LoggerProxy.logger.log(`Meeting:index#setLocalVideoQuality --> Setting quality to ${level}`);

    if (!VIDEO_RESOLUTIONS[level]) {
      return this.rejectWithErrorLog(`Meeting:index#setLocalVideoQuality --> ${level} not defined`);
    }

    if (!this.mediaProperties.mediaDirection.sendVideo) {
      return this.rejectWithErrorLog(
        'Meeting:index#setLocalVideoQuality --> unable to change video quality, sendVideo is disabled'
      );
    }

    // If level is already the same, don't do anything
    if (level === this.mediaProperties.localQualityLevel) {
      LoggerProxy.logger.warn(
        `Meeting:index#setLocalQualityLevel --> Quality already set to ${level}`
      );

      return Promise.resolve();
    }

    // Set the quality level in properties
    this.mediaProperties.setLocalQualityLevel(level);

    const mediaDirection = {
      sendAudio: this.mediaProperties.mediaDirection.sendAudio,
      sendVideo: this.mediaProperties.mediaDirection.sendVideo,
      sendShare: this.mediaProperties.mediaDirection.sendShare,
    };

    // When changing local video quality level
    // Need to stop current track first as chrome doesn't support resolution upscaling(for eg. changing 480p to 720p)
    // Without feeding it a new track
    // open bug link: https://bugs.chromium.org/p/chromium/issues/detail?id=943469
    if (isBrowser('chrome') && this.mediaProperties.videoTrack)
      Media.stopTracks(this.mediaProperties.videoTrack);

    return this.getMediaStreams(mediaDirection, VIDEO_RESOLUTIONS[level]).then(
      async ([localStream]) => {
        await this.updateVideo({
          sendVideo: true,
          receiveVideo: true,
          stream: localStream,
        });

        return localStream;
      }
    );
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

    return this.updateMedia({mediaSettings: this.mediaProperties.mediaDirection});
  }

  /**
   * This is deprecated, please use setLocalVideoQuality for setting local and setRemoteQualityLevel for remote
   * @param {String} level {LOW|MEDIUM|HIGH}
   * @returns {Promise}
   * @deprecated After FHD support
   */
  setMeetingQuality(level: string) {
    LoggerProxy.logger.log(`Meeting:index#setMeetingQuality --> Setting quality to ${level}`);

    if (!QUALITY_LEVELS[level]) {
      return this.rejectWithErrorLog(`Meeting:index#setMeetingQuality --> ${level} not defined`);
    }

    const previousLevel = {
      local: this.mediaProperties.localQualityLevel,
      remote: this.mediaProperties.remoteQualityLevel,
    };

    // If level is already the same, don't do anything
    if (
      level === this.mediaProperties.localQualityLevel &&
      level === this.mediaProperties.remoteQualityLevel
    ) {
      LoggerProxy.logger.warn(
        `Meeting:index#setMeetingQuality --> Quality already set to ${level}`
      );

      return Promise.resolve();
    }

    // Determine the direction of our current media
    const {receiveAudio, receiveVideo, sendVideo} = this.mediaProperties.mediaDirection;

    return (sendVideo ? this.setLocalVideoQuality(level) : Promise.resolve())
      .then(() =>
        receiveAudio || receiveVideo ? this.setRemoteQualityLevel(level) : Promise.resolve()
      )
      .catch((error) => {
        // From troubleshooting it seems that the stream itself doesn't change the max-fs if the peer connection isn't stable
        this.mediaProperties.setLocalQualityLevel(previousLevel.local);
        this.mediaProperties.setRemoteQualityLevel(previousLevel.remote);

        LoggerProxy.logger.error(`Meeting:index#setMeetingQuality --> ${error.message}`);

        Metrics.sendBehavioralMetric(
          BEHAVIORAL_METRICS.SET_MEETING_QUALITY_FAILURE,
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
   *
   * NOTE: this method can only be used with transcoded meetings, for multistream use publishTrack()
   *
   * @param {Object} options parameter
   * @param {Boolean} options.sendAudio send audio from the display share
   * @param {Boolean} options.sendShare send video from the display share
   * @param {Object} options.sharePreferences
   * @param {MediaTrackConstraints} options.sharePreferences.shareConstraints constraints to apply to video
   *   @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints}
   * @param {Boolean} options.sharePreferences.highFrameRate if shareConstraints isn't provided, set default values based off of this boolean
   * @returns {Promise}
   */
  shareScreen(
    options: {
      sendAudio: boolean;
      sendShare: boolean;
      sharePreferences: {shareConstraints: MediaTrackConstraints};
    } = {} as any
  ) {
    LoggerProxy.logger.log('Meeting:index#shareScreen --> Getting local share');

    const shareConstraints = {
      sendShare: true,
      sendAudio: false,
      ...options,
    };

    // @ts-ignore - config coming from registerPlugin
    return Media.getDisplayMedia(shareConstraints, this.config)
      .then((shareStream) =>
        this.updateShare({
          sendShare: true,
          receiveShare: this.mediaProperties.mediaDirection.receiveShare,
          stream: shareStream,
        })
      )
      .catch((error) => {
        // Whenever there is a failure when trying to access a user's display
        // report it as an Behavioral metric
        // This gives visibility into common errors and can help
        // with further troubleshooting

        // This metrics will get erros for getDisplayMedia and share errors for now
        // TODO: The getDisplayMedia errors need to be moved inside `media.getDisplayMedia`
        const metricName = BEHAVIORAL_METRICS.GET_DISPLAY_MEDIA_FAILURE;
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
        throw new MediaError('Unable to retrieve display media stream', error);
      });
  }

  /**
   * Functionality for when a share is ended.
   * @private
   * @memberof Meeting
   * @param {MediaStream} localShare
   * @returns {undefined}
   */
  private handleShareTrackEnded = async () => {
    if (this.wirelessShare) {
      this.leave({reason: MEETING_REMOVED_REASON.USER_ENDED_SHARE_STREAMS});
    } else if (this.isMultistream) {
      try {
        if (this.mediaProperties.mediaDirection.sendShare) {
          await this.releaseScreenShareFloor();
        }
      } catch (error) {
        LoggerProxy.logger.log(
          'Meeting:index#handleShareTrackEnded --> Error stopping share: ',
          error
        );
      } finally {
        this.setLocalShareTrack(null);
        this.mediaProperties.mediaDirection.sendShare = false;
      }
    } else {
      // Skip checking for a stable peerConnection
      // to allow immediately stopping screenshare
      this.stopShare({
        skipSignalingCheck: true,
      }).catch((error) => {
        LoggerProxy.logger.log(
          'Meeting:index#handleShareTrackEnded --> Error stopping share: ',
          error
        );
      });
    }

    Trigger.trigger(
      this,
      {
        file: 'meeting/index',
        function: 'handleShareTrackEnded',
      },
      EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
      {
        type: EVENT_TYPES.LOCAL_SHARE,
      }
    );
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
    audioTrack: LocalMicrophoneTrack | null;
    videoTrack: LocalCameraTrack | null;
  }) {
    MeetingUtil.handleVideoLogging(mediaProperties.videoTrack);
    MeetingUtil.handleAudioLogging(mediaProperties.audioTrack);
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {undefined}
   */
  setStartSetupDelay(typeMedia: string) {
    this[`startSetupDelay${typeMedia}`] = performance.now();
    this[`endSetupDelay${typeMedia}`] = undefined;
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {undefined}
   */
  setEndSetupDelay(typeMedia: string) {
    this[`endSetupDelay${typeMedia}`] = performance.now();
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {string} duration between start and end of setup
   */
  getSetupDelayDuration(typeMedia: string) {
    const start = this[`startSetupDelay${typeMedia}`];
    const end = this[`endSetupDelay${typeMedia}`];

    return start && end ? end - start : undefined;
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {undefined}
   */
  setStartSendingMediaDelay(typeMedia: string) {
    this[`startSendingMediaDelay${typeMedia}`] = performance.now();
    this[`endSendingMediaDelay${typeMedia}`] = undefined;
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {undefined}
   */
  setEndSendingMediaDelay(typeMedia: string) {
    this[`endSendingMediaDelay${typeMedia}`] = performance.now();
  }

  /**
   * @param {string} typeMedia 'audio' or 'video'
   * @returns {string} duration between join response and first media tx
   */
  getSendingMediaDelayDuration(typeMedia: string) {
    const start = this[`startSendingMediaDelay${typeMedia}`];
    const end = this[`endSendingMediaDelay${typeMedia}`];

    return start && end ? end - start : undefined;
  }

  /**
   *
   * @returns {undefined}
   */
  setStartLocalSDPGenRemoteSDPRecvDelay() {
    if (!this.startLocalSDPGenRemoteSDPRecvDelay) {
      this.startLocalSDPGenRemoteSDPRecvDelay = performance.now();
      this.endLocalSDPGenRemoteSDPRecvDelay = undefined;
    }
  }

  /**
   *
   * @returns {undefined}
   */
  setEndLocalSDPGenRemoteSDPRecvDelay() {
    if (!this.endLocalSDPGenRemoteSDPRecvDelay) {
      this.endLocalSDPGenRemoteSDPRecvDelay = performance.now();
    }
  }

  /**
   *
   * @returns {string} duration between local SDP generation and remote SDP reception
   */
  getLocalSDPGenRemoteSDPRecvDelay() {
    const start = this.startLocalSDPGenRemoteSDPRecvDelay;
    const end = this.endLocalSDPGenRemoteSDPRecvDelay;

    if (start && end) {
      const calculatedDelay = end - start;

      return calculatedDelay > METRICS_JOIN_TIMES_MAX_DURATION ? undefined : calculatedDelay;
    }

    return undefined;
  }

  /**
   *
   * @returns {undefined}
   */
  setStartCallInitiateJoinReq() {
    this.startCallInitiateJoinReq = performance.now();
    this.endCallInitiateJoinReq = undefined;
  }

  /**
   *
   * @returns {undefined}
   */
  setEndCallInitiateJoinReq() {
    this.endCallInitiateJoinReq = performance.now();
  }

  /**
   *
   * @returns {string} duration between call initiate and sending join request to locus
   */
  getCallInitiateJoinReq() {
    const start = this.startCallInitiateJoinReq;
    const end = this.endCallInitiateJoinReq;

    if (start && end) {
      const calculatedDelay = end - start;

      return calculatedDelay > METRICS_JOIN_TIMES_MAX_DURATION ? undefined : calculatedDelay;
    }

    return undefined;
  }

  /**
   *
   * @returns {undefined}
   */
  setStartJoinReqResp() {
    this.startJoinReqResp = performance.now();
    this.endJoinReqResp = undefined;
  }

  /**
   *
   * @returns {undefined}
   */
  setEndJoinReqResp() {
    this.endJoinReqResp = performance.now();
  }

  /**
   *
   * @returns {string} duration between sending locus join request and receiving join response
   */
  getJoinReqResp() {
    const start = this.startJoinReqResp;
    const end = this.endJoinReqResp;

    if (start && end) {
      const calculatedDelay = end - start;

      return calculatedDelay > METRICS_JOIN_TIMES_MAX_DURATION ? undefined : calculatedDelay;
    }

    return undefined;
  }

  /**
   *
   * @returns {string} duration between call initiate and successful locus join (even if it is in lobby)
   */
  getTotalJmt() {
    const start = this.startCallInitiateJoinReq;
    const end = this.endJoinReqResp;

    return start && end ? end - start : undefined;
  }

  /**
   * End the current meeting for all
   * @returns {Promise}
   * @public
   * @memberof Meeting
   */
  public endMeetingForAll() {
    Metrics.postEvent({
      event: eventType.LEAVE,
      meeting: this,
      data: {trigger: trigger.USER_INTERACTION, canProceed: false},
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
    this.isSharing = false;
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
    throw new Error('Webrtc media connection is missing, call addMedia() first');
  }

  /**
   * Publishes specified local tracks in the meeting
   *
   * @param {Object} tracks
   * @returns {Promise}
   */
  async publishTracks(tracks: {
    microphone?: MediaStreamTrack;
    camera?: MediaStreamTrack;
    screenShare: {
      audio?: MediaStreamTrack; // todo: for now screen share audio is not supported (will be done in SPARK-399690)
      video?: MediaStreamTrack;
    };
  }): Promise<void> {
    this.checkMediaConnection();

    if (tracks.screenShare?.video) {
      // we are starting a screen share
      this.setLocalShareTrack(tracks.screenShare.video);

      await this.requestScreenShareFloor();
      this.mediaProperties.mediaDirection.sendShare = true;

      await this.mediaProperties.webrtcMediaConnection.publishTrack(
        this.mediaProperties.shareTrack
      );
    }

    if (tracks.microphone) {
      this.setLocalAudioTrack(tracks.microphone);
      this.mediaProperties.mediaDirection.sendAudio = true;

      // audio mute state could be undefined if you have not sent audio before
      this.audio = this.audio || createMuteState(AUDIO, this, this.mediaProperties.mediaDirection);

      await this.mediaProperties.webrtcMediaConnection.publishTrack(
        this.mediaProperties.audioTrack
      );
    }

    if (tracks.camera) {
      this.setLocalVideoTrack(tracks.camera);
      this.mediaProperties.mediaDirection.sendVideo = true;

      // video state could be undefined if you have not sent video before
      this.video = this.video || createMuteState(VIDEO, this, this.mediaProperties.mediaDirection);

      await this.mediaProperties.webrtcMediaConnection.publishTrack(
        this.mediaProperties.videoTrack
      );
    }
  }

  /**
   * Un-publishes specified local tracks in the meeting
   *
   * @param {Array<MediaStreamTrack>} tracks
   * @returns {Promise}
   */
  async unpublishTracks(tracks: MediaStreamTrack[]): Promise<void> {
    this.checkMediaConnection();

    const unpublishPromises = [];

    for (const track of tracks) {
      // @ts-ignore originalTrack is private - this will be fixed in SPARK-399694
      if (track === this.mediaProperties.shareTrack?.originalTrack) {
        const localTrackToUnpublish = this.mediaProperties.shareTrack;

        this.setLocalShareTrack(null);

        this.releaseScreenShareFloor(); // we ignore the returned promise here on purpose
        this.mediaProperties.mediaDirection.sendShare = false;

        unpublishPromises.push(
          this.mediaProperties.webrtcMediaConnection.unpublishTrack(localTrackToUnpublish)
        );
      }

      // @ts-ignore originalTrack is private - this will be fixed in SPARK-399694
      if (track === this.mediaProperties.audioTrack?.originalTrack) {
        const localTrackToUnpublish = this.mediaProperties.audioTrack;

        this.setLocalAudioTrack(null);
        this.mediaProperties.mediaDirection.sendAudio = false;

        unpublishPromises.push(
          this.mediaProperties.webrtcMediaConnection.unpublishTrack(localTrackToUnpublish)
        );
      }

      // @ts-ignore originalTrack is private - this will be fixed in SPARK-399694
      if (track === this.mediaProperties.videoTrack?.originalTrack) {
        const localTrackToUnpublish = this.mediaProperties.videoTrack;

        this.setLocalVideoTrack(null);
        this.mediaProperties.mediaDirection.sendVideo = false;

        unpublishPromises.push(
          this.mediaProperties.webrtcMediaConnection.unpublishTrack(localTrackToUnpublish)
        );
      }
    }

    await Promise.all(unpublishPromises);
  }
}
