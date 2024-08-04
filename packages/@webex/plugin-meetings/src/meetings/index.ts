/* eslint no-shadow: ["error", { "allow": ["eventType"] }] */
import {union} from 'lodash';
import '@webex/internal-plugin-mercury';
import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-metrics';
// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';
import {setLogger} from '@webex/internal-media-core';

import * as mediaHelpersModule from '@webex/media-helpers';

import 'webrtc-adapter';

import Metrics from '../metrics';
import LoggerConfig from '../common/logs/logger-config';
import StaticConfig from '../common/config';
import LoggerProxy from '../common/logs/logger-proxy';
import LoggerRequest from '../common/logs/request';
import Trigger from '../common/events/trigger-proxy';
import Media from '../media';
import MeetingUtil from '../meeting/util';
import {
  MEETINGS,
  EVENTS,
  EVENT_TRIGGERS,
  READY,
  LOCUSEVENT,
  MAX_RANDOM_DELAY_FOR_MEETING_INFO,
  ROAP,
  ONLINE,
  OFFLINE,
  _MEETING_,
  _JOIN_,
  _INCOMING_,
  LOCUS,
  _LEFT_,
  _ID_,
  MEETING_REMOVED_REASON,
  _JOINED_,
  _MOVED_,
  _ON_HOLD_LOBBY_,
  _WAIT_,
  DESTINATION_TYPE,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import MeetingInfo from '../meeting-info';
import MeetingInfoV2 from '../meeting-info/meeting-info-v2';
import Meeting, {CallStateForMetrics} from '../meeting';
import PersonalMeetingRoom from '../personal-meeting-room';
import Reachability from '../reachability';
import Request from './request';
import PasswordError from '../common/errors/password-error';
import CaptchaError from '../common/errors/captcha-error';
import MeetingCollection, {MEETING_KEY} from './collection';
import MeetingsUtil from './util';
import PermissionError from '../common/errors/permission';
import {INoiseReductionEffect, IVirtualBackgroundEffect} from './meetings.types';
import {SpaceIDDeprecatedError} from '../common/errors/webex-errors';
import NoMeetingInfoError from '../common/errors/no-meeting-info';

let mediaLogger;

class MediaLogger {
  info(...args) {
    LoggerProxy.logger.info(...args);
  }

  log(...args) {
    LoggerProxy.logger.log(...args);
  }

  error(...args) {
    LoggerProxy.logger.error(...args);
  }

  warn(...args) {
    LoggerProxy.logger.warn(...args);
  }

  trace(...args) {
    LoggerProxy.logger.trace(...args);
  }

  debug(...args) {
    LoggerProxy.logger.debug(...args);
  }
}
/**
 * Meetings Ready Event
 * Emitted when the meetings instance on webex is ready
 * @event meetings:ready
 * @instance
 * @memberof Meetings
 */

/**
 * Meetings Network Disconnected Event
 * Emitted when the meetings instance is disconnected from
 * the internal mercury server
 * @event network:disconnected
 * @instance
 * @memberof Meetings
 */

/**
 * Meetings Registered Event
 * Emitted when the meetings instance has been registered and listening
 * @event meetings:registered
 * @instance
 * @memberof Meetings
 */

/**
 * Meeting Removed Event
 * Emitted when a meeting was removed from the cache of meetings
 * @event meeting:removed
 * @instance
 * @type {Object}
 * @property {String} meetingId the removed meeting
 * @property {Object} response the server response
 * @property {String} type what type of meeting it was
 * @memberof Meetings
 */

/**
 * Meeting Added Event
 * Emitted when a meeting was added to the cache of meetings
 * @event meeting:added
 * @instance
 * @type {Object}
 * @property {String} meetingId the added meeting
 * @property {String} type what type of meeting it was
 * @memberof Meetings
 */

/**
 * Maintain a cache of meetings and sync with services.
 * @class
 */
export default class Meetings extends WebexPlugin {
  loggerRequest: any;
  media: any;
  meetingCollection: any;
  personalMeetingRoom: any;
  preferredWebexSite: any;
  reachability: Reachability;
  registered: any;
  request: any;
  geoHintInfo: any;
  meetingInfo: any;
  mediaHelpers: any;
  breakoutLocusForHandleLater: any;
  namespace = MEETINGS;

  /**
   * Initializes the Meetings Plugin
   * @constructor
   * @public
   * @memberof Meetings
   */
  constructor(...args) {
    super(...args);

    /**
     * The webrtc-core media helpers. This is a temporary solution required for the SDK sample app
     * to be able to call media helper functions.
     *
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    this.mediaHelpers = mediaHelpersModule;

    /**
     * The Meetings request to interact with server
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    // @ts-ignore
    this.request = new Request({}, {parent: this.webex});
    /**
     * Log upload request helper
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    // @ts-ignore
    this.loggerRequest = new LoggerRequest({webex: this.webex});
    this.meetingCollection = new MeetingCollection();
    /**
     * The PersonalMeetingRoom object to interact with server
     * @instance
     * @type {Object}
     * @public
     * @memberof Meetings
     */
    this.personalMeetingRoom = null;

    /**
     * The Reachability object to interact with server
     * starts as null
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    // @ts-ignore
    this.reachability = new Reachability(this.webex);

    /**
     * If the meetings plugin has been registered and listening via {@link Meetings#register}
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Meetings
     */
    this.registered = false;

    /**
     * This values indicates the preferred webex site the user will start there meeting, getsits value from {@link Meetings#register}
     * @instance
     * @type {String}
     * @private
     * @memberof Meetings
     */
    this.preferredWebexSite = '';

    /**
     * The public interface for the internal Media util files. These are helpful to expose outside the context
     * of a meeting so that a user can access media without creating a meeting instance.
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    this.media = {
      getUserMedia: Media.getUserMedia,
    };

    this.onReady();
  }

  /**
   * check whether you need to handle this main session's locus data or not
   * @param {Object} meeting current meeting data
   * @param {Object} newLocus new locus data
   * @returns {boolean}
   * @private
   * @memberof Meetings
   */
  private isNeedHandleMainLocus(meeting: any, newLocus: any) {
    const breakoutUrl = newLocus.controls?.breakout?.url;
    const breakoutLocus = this.meetingCollection.getActiveBreakoutLocus(breakoutUrl);

    const isSelfJoined = newLocus?.self?.state === _JOINED_;
    const isSelfMoved = newLocus?.self?.state === _LEFT_ && newLocus?.self?.reason === _MOVED_;
    // @ts-ignore
    const deviceFromNewLocus = MeetingsUtil.getThisDevice(newLocus, this.webex.internal.device.url);
    const isResourceMovedOnThisDevice =
      deviceFromNewLocus?.state === _LEFT_ && deviceFromNewLocus?.reason === _MOVED_;

    const isNewLocusJoinThisDevice = MeetingsUtil.joinedOnThisDevice(
      meeting,
      newLocus,
      // @ts-ignore
      this.webex.internal.device.url
    );
    const isBreakoutLocusJoinThisDevice =
      breakoutLocus?.joinedWith?.correlationId &&
      breakoutLocus.joinedWith.correlationId === meeting?.correlationId;

    if (isSelfJoined && isNewLocusJoinThisDevice) {
      LoggerProxy.logger.log(
        'Meetings:index#isNeedHandleMainLocus --> self this device shown as JOINED in the main session'
      );
      if (breakoutLocus?.joinedWith && deviceFromNewLocus) {
        const breakoutReplaceAt =
          breakoutLocus.joinedWith.replaces?.length > 0
            ? breakoutLocus.joinedWith.replaces[0].replaceAt
            : '';
        const newLocusReplaceAt =
          deviceFromNewLocus.replaces?.length > 0 ? deviceFromNewLocus.replaces[0].replaceAt : '';
        if (breakoutReplaceAt && newLocusReplaceAt && breakoutReplaceAt > newLocusReplaceAt) {
          LoggerProxy.logger.log(
            `Meetings:index#isNeedHandleMainLocus --> this is expired main joined status locus_dto replacedAt ${newLocusReplaceAt} bo replacedAt ${breakoutReplaceAt}`
          );

          return false;
        }
      }

      return true;
    }
    if (isBreakoutLocusJoinThisDevice) {
      LoggerProxy.logger.log(
        `Meetings:index#isNeedHandleMainLocus --> there is active breakout session and joined on this device, and don't need to handle main session: ${breakoutUrl}`
      );

      return false;
    }
    if (isSelfMoved && (newLocus?.self?.removed || isResourceMovedOnThisDevice)) {
      LoggerProxy.logger.log(
        'Meetings:index#isNeedHandleMainLocus --> self moved main locus with self removed status or with device resource moved, not need to handle'
      );

      return false;
    }
    if (isSelfJoined && isResourceMovedOnThisDevice) {
      LoggerProxy.logger.log(
        'Meetings:index#isNeedHandleMainLocus --> self device left&moved in main locus with self joined status, not need to handle'
      );

      return false;
    }
    LoggerProxy.logger.log(
      'Meetings:index#isNeedHandleMainLocus --> this is a normal main session locusDTO update case'
    );

    return true;
  }

  /**
   * check whether you need to handle this locus data or not
   * @param {Object} meeting old locus data
   * @param {Object} newLocus new locus data
   * @returns {boolean}
   * @private
   * @memberof Meetings
   */
  private isNeedHandleLocusDTO(meeting: any, newLocus: any) {
    if (newLocus) {
      const isNewLocusAsBreakout = MeetingsUtil.isBreakoutLocusDTO(newLocus);
      const isSelfMoved = newLocus?.self?.state === _LEFT_ && newLocus?.self?.reason === _MOVED_;
      const isSelfMovedToLobby =
        newLocus?.self?.devices[0]?.intent?.reason === _ON_HOLD_LOBBY_ &&
        newLocus?.self?.devices[0]?.intent?.type === _WAIT_;
      if (!meeting) {
        if (isNewLocusAsBreakout) {
          LoggerProxy.logger.log(
            `Meetings:index#isNeedHandleLocusDTO --> the first breakout session locusDTO active status: ${newLocus.fullState?.active}`
          );

          return newLocus.self?.state === _JOINED_;
        }

        return this.isNeedHandleMainLocus(meeting, newLocus);
      }
      if (!isNewLocusAsBreakout) {
        return isSelfMovedToLobby || this.isNeedHandleMainLocus(meeting, newLocus);
      }

      return !isSelfMoved;
    }

    return true;
  }

  /**
   * get corresponding meeting object by locus data
   * @param {Object} data a locus event
   * @param {String} data.locusUrl
   * @param {Object} data.locus
   * @returns {Object}
   * @private
   * @memberof Meetings
   */
  getCorrespondingMeetingByLocus(data) {
    // getting meeting by correlationId. This will happen for the new event
    // Either the locus
    // TODO : Add check for the callBack Address
    return (
      this.meetingCollection.getByKey(MEETING_KEY.LOCUS_URL, data.locusUrl) ||
      // @ts-ignore
      this.meetingCollection.getByKey(
        MEETING_KEY.CORRELATION_ID,
        // @ts-ignore
        MeetingsUtil.checkForCorrelationId(this.webex.internal.device.url, data.locus)
      ) ||
      this.meetingCollection.getByKey(
        MEETING_KEY.SIP_URI,
        data.locus.self &&
          data.locus.self.callbackInfo &&
          data.locus.self.callbackInfo.callbackAddress
      ) ||
      (data.locus.info?.isUnifiedSpaceMeeting
        ? undefined
        : this.meetingCollection.getByKey(
            MEETING_KEY.CONVERSATION_URL,
            data.locus.conversationUrl
          )) ||
      this.meetingCollection.getByKey(MEETING_KEY.MEETINGNUMBER, data.locus?.info?.webExMeetingId)
    );
  }

  /**
   * handle locus events and takes meeting actions with them as they come in
   * @param {Object} data a locus event
   * @param {String} data.locusUrl
   * @param {Object} data.locus
   * @param {Boolean} useRandomDelayForInfo whether a random delay should be added to fetching meeting info
   * @param {String} data.eventType
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private handleLocusEvent(data: {locusUrl: string; locus: any}, useRandomDelayForInfo = false) {
    let meeting = this.getCorrespondingMeetingByLocus(data);

    // Special case when locus has got replaced, This only happend once if a replace locus exists
    // https://sqbu-github.cisco.com/WebExSquared/locus/wiki/Locus-changing-mid-call

    if (!meeting && data.locus?.replaces?.length > 0) {
      // Always the last element in the replace is the active one
      meeting = this.meetingCollection.getByKey(
        MEETING_KEY.LOCUS_URL,
        data.locus.replaces[data.locus.replaces.length - 1].locusUrl
      );
    }

    if (meeting && !MeetingsUtil.isBreakoutLocusDTO(data.locus)) {
      meeting.locusInfo.updateMainSessionLocusCache(data.locus);
    }
    if (!this.isNeedHandleLocusDTO(meeting, data.locus)) {
      LoggerProxy.logger.log(
        `Meetings:index#handleLocusEvent --> doesn't need to process locus event`
      );

      return;
    }
    if (!meeting) {
      // TODO: create meeting when we get a meeting object
      // const checkForEnded = (locus) => {
      // TODO: you already ended the meeting but you got an event later
      // Mainly for 1:1 Callsor meeting
      // Happens mainly after refresh

      // 1:1 Meeting
      // 1)  You ended a call before but you got a mercury event
      // Make sure end the call and cleanup the meeting only if the mercury
      // event says so
      // 2) Maintain lastSync time in the meetings object which helps to compare
      // If the meeting came befor or after the sync . ANy meeting start time before the sync time is invalid

      // For space Meeting
      // Check the locus object and see who has joined

      // };
      // rather then locus object change to locus url

      if (
        data.locus &&
        data.locus.fullState &&
        data.locus.fullState.state === LOCUS.STATE.INACTIVE
      ) {
        // just ignore the event as its already ended and not active
        LoggerProxy.logger.warn(
          'Meetings:index#handleLocusEvent --> Locus event received for meeting, after it was ended.'
        );

        return;
      }

      // When its wireless share or guest and user leaves the meeting we dont have to keep the meeting object
      // Any future events will be neglected

      if (
        data.locus &&
        data.locus.self &&
        data.locus.self.state === _LEFT_ &&
        data.locus.self.removed === true
      ) {
        // just ignore the event as its already ended and not active
        LoggerProxy.logger.warn(
          'Meetings:index#handleLocusEvent --> Locus event received for meeting, after it was ended.'
        );

        return;
      }

      this.create(data.locus, DESTINATION_TYPE.LOCUS_ID, useRandomDelayForInfo)
        .then((newMeeting) => {
          meeting = newMeeting;

          // It's a new meeting so initialize the locus data
          meeting.locusInfo.initialSetup(data.locus);
          this.checkHandleBreakoutLocus(data.locus);
        })
        .catch((e) => {
          LoggerProxy.logger.error(e);
        })
        .finally(() => {
          // There will be cases where locus event comes in gets created and deleted because its a 1:1 and meeting gets deleted
          // because the other user left so before sending 'added' event make sure it exists in the collection

          if (this.getMeetingByType(_ID_, meeting.id)) {
            // @ts-ignore
            this.webex.internal.newMetrics.submitClientEvent({
              name: 'client.call.remote-started',
              payload: {
                trigger: 'mercury-event',
              },
              options: {
                meetingId: meeting.id,
              },
            });
            Trigger.trigger(
              this,
              {
                file: 'meetings',
                function: 'handleLocusEvent',
              },
              EVENT_TRIGGERS.MEETING_ADDED,
              {
                meeting,
                type: meeting.type === _MEETING_ ? _JOIN_ : _INCOMING_,
              }
            );
          } else {
            // Meeting got added but was not found in the collection. It might have got destroyed
            LoggerProxy.logger.warn(
              'Meetings:index#handleLocusEvent --> Created and destroyed meeting object before sending an event'
            );
          }
        });
    } else {
      meeting.locusInfo.parse(meeting, data);
    }
  }

  /**
   * handles locus events through mercury that are not roap
   * @param {Object} envelope
   * @param {Object} envelope.data
   * @param {String} envelope.data.eventType
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private handleLocusMercury(envelope: {data: any}) {
    const {data} = envelope;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const {eventType} = data;

    if (eventType && eventType !== LOCUSEVENT.MESSAGE_ROAP) {
      this.handleLocusEvent(data, true);
    }
  }

  /**
   * handles mecury offline event
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private handleMercuryOffline() {
    Trigger.trigger(
      this,
      {
        file: 'meetings/index',
        function: 'handleMercuryOffline',
      },
      EVENT_TRIGGERS.MEETINGS_NETWORK_DISCONNECTED
    );
  }

  /**
   * registers for locus and roap mercury events
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private listenForEvents() {
    // @ts-ignore
    this.webex.internal.mercury.on(LOCUSEVENT.LOCUS_MERCURY, (envelope) => {
      this.handleLocusMercury(envelope);
    });
    // @ts-ignore
    this.webex.internal.mercury.on(ROAP.ROAP_MERCURY, (envelope) => {
      MeetingsUtil.handleRoapMercury(envelope, this.meetingCollection);
    });

    // @ts-ignore
    this.webex.internal.mercury.on(ONLINE, () => {
      this.syncMeetings({keepOnlyLocusMeetings: false});
    });

    // @ts-ignore
    this.webex.internal.mercury.on(OFFLINE, () => {
      this.handleMercuryOffline();
    });
  }

  /**
   * stops listening for locus and roap mercury events
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private stopListeningForEvents() {
    // @ts-ignore
    this.webex.internal.mercury.off(LOCUSEVENT.LOCUS_MERCURY);
    // @ts-ignore
    this.webex.internal.mercury.off(ROAP.ROAP_MERCURY);
    // @ts-ignore
    this.webex.internal.mercury.off(ONLINE);
  }

  /**
   * @returns {undefined}
   * @private
   * @memberof Meetings
   */
  private onReady() {
    // @ts-ignore
    this.webex.once(READY, () => {
      // @ts-ignore
      StaticConfig.set(this.config);
      // @ts-ignore
      LoggerConfig.set(this.config.logging);
      // @ts-ignore
      LoggerProxy.set(this.webex.logger);

      mediaLogger = new MediaLogger();
      setLogger(mediaLogger);

      /**
       * The MeetingInfo object to interact with server
       * @instance
       * @type {Object}
       * @private
       * @memberof Meetings
       */
      // @ts-ignore
      this.meetingInfo = this.config.experimental.enableUnifiedMeetings
        ? // @ts-ignore
          new MeetingInfoV2(this.webex)
        : // @ts-ignore
          new MeetingInfo(this.webex);
      // @ts-ignore
      this.personalMeetingRoom = new PersonalMeetingRoom(
        {meetingInfo: this.meetingInfo},
        // @ts-ignore
        {parent: this.webex}
      );

      Trigger.trigger(
        this,
        {
          file: 'meetings',
          function: 'onReady',
        },
        EVENT_TRIGGERS.MEETINGS_READY
      );

      MeetingsUtil.checkH264Support({disableNotifications: true});
      // @ts-ignore
      Metrics.initialSetup(this.webex);
    });
  }

  /**
   * API to toggle unified meetings
   * @param {Boolean} changeState
   * @private
   * @memberof Meetings
   * @returns {undefined}
   */
  private _toggleUnifiedMeetings(changeState: boolean) {
    if (typeof changeState !== 'boolean') {
      return;
    }
    // @ts-ignore
    if (this.config?.experimental?.enableUnifiedMeetings !== changeState) {
      // @ts-ignore
      this.config.experimental.enableUnifiedMeetings = changeState;
      // @ts-ignore
      this.meetingInfo = changeState ? new MeetingInfoV2(this.webex) : new MeetingInfo(this.webex);
    }
  }

  /**
   * API to toggle starting adhoc meeting
   * @param {Boolean} changeState
   * @private
   * @memberof Meetings
   * @returns {undefined}
   */
  private _toggleAdhocMeetings(changeState: boolean) {
    if (typeof changeState !== 'boolean') {
      return;
    }
    // @ts-ignore
    if (this.config?.experimental?.enableAdhocMeetings !== changeState) {
      // @ts-ignore
      this.config.experimental.enableAdhocMeetings = changeState;
    }
  }

  /**
   * API to toggle TCP reachability, needs to be called before webex.meetings.register()
   * @param {Boolean} newValue
   * @private
   * @memberof Meetings
   * @returns {undefined}
   */
  private _toggleTcpReachability(newValue: boolean) {
    if (typeof newValue !== 'boolean') {
      return;
    }
    // @ts-ignore
    if (this.config.experimental.enableTcpReachability !== newValue) {
      // @ts-ignore
      this.config.experimental.enableTcpReachability = newValue;
    }
  }

  /**
   * API to toggle TLS reachability, needs to be called before webex.meetings.register()
   * @param {Boolean} newValue
   * @private
   * @memberof Meetings
   * @returns {undefined}
   */
  private _toggleTlsReachability(newValue: boolean) {
    if (typeof newValue !== 'boolean') {
      return;
    }
    // @ts-ignore
    if (this.config.experimental.enableTlsReachability !== newValue) {
      // @ts-ignore
      this.config.experimental.enableTlsReachability = newValue;
    }
  }

  /**
   * Explicitly sets up the meetings plugin by registering
   * the device, connecting to mercury, and listening for locus events.
   *
   * @returns {Promise}
   * @public
   * @memberof Meetings
   */
  public register() {
    // @ts-ignore
    if (!this.webex.canAuthorize) {
      LoggerProxy.logger.error(
        'Meetings:index#register --> ERROR, Unable to register, SDK cannot authorize'
      );

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      LoggerProxy.logger.info(
        'Meetings:index#register --> INFO, Meetings plugin already registered'
      );

      return Promise.resolve();
    }

    return Promise.all([
      this.fetchUserPreferredWebexSite(),
      this.getGeoHint(),
      this.startReachability().catch((error) => {
        LoggerProxy.logger.error(`Meetings:index#register --> GDM error, ${error.message}`);
      }),
      // @ts-ignore
      this.webex.internal.device
        .register()
        // @ts-ignore
        .then(() =>
          LoggerProxy.logger.info(
            // @ts-ignore
            `Meetings:index#register --> INFO, Device registered ${this.webex.internal.device.url}`
          )
        )
        // @ts-ignore
        .then(() => this.webex.internal.mercury.connect()),
      MeetingsUtil.checkH264Support.call(this),
    ])
      .then(() => {
        this.listenForEvents();
        Trigger.trigger(
          this,
          {
            file: 'meetings',
            function: 'register',
          },
          EVENT_TRIGGERS.MEETINGS_REGISTERED
        );
        this.registered = true;
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETINGS_REGISTRATION_SUCCESS);
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `Meetings:index#register --> ERROR, Unable to register, ${error.message}`
        );

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETINGS_REGISTRATION_FAILED, {
          reason: error.message,
          stack: error.stack,
        });

        return Promise.reject(error);
      });
  }

  /**
   * Explicitly tears down the meetings plugin by deregistering
   * the device, disconnecting from mercury, and stops listening to locus events
   *
   * @returns {Promise}
   * @public
   * @memberof Meetings
   */
  unregister() {
    if (!this.registered) {
      LoggerProxy.logger.info(
        'Meetings:index#unregister --> INFO, Meetings plugin already unregistered'
      );

      return Promise.resolve();
    }

    this.stopListeningForEvents();

    return (
      // @ts-ignore
      this.webex.internal.mercury
        .disconnect()
        // @ts-ignore
        .then(() => this.webex.internal.device.unregister())
        .then(() => {
          Trigger.trigger(
            this,
            {
              file: 'meetings',
              function: 'unregister',
            },
            EVENT_TRIGGERS.MEETINGS_UNREGISTERED
          );
          this.registered = false;
        })
    );
  }

  /**
   * Creates a noise reduction effect
   *
   * @param {INoiseReductionEffect} options optional custom effect options
   * @returns {Promise<effect>} noise reduction effect.
   * @public
   * @memberof Meetings
   */
  createNoiseReductionEffect = async (options?: INoiseReductionEffect) => {
    // @ts-ignore
    const authToken = this.webex.credentials.supertoken.access_token;

    return new mediaHelpersModule.NoiseReductionEffect({authToken, ...options});
  };

  /**
   * Creates a virtual background effect
   *
   * @param {IVirtualBackgroundEffect} options optional custom effect options
   * @returns {Promise<effect>} virtual background effect.
   * @public
   * @memberof Meetings
   */
  createVirtualBackgroundEffect = async (options?: IVirtualBackgroundEffect) => {
    // @ts-ignore
    const authToken = this.webex.credentials.supertoken.access_token;

    return new mediaHelpersModule.VirtualBackgroundEffect({authToken, ...options});
  };

  /**
   * Uploads logs to the webex services for tracking
   * @param {Object} [options={}]
   * @param {String} [options.callStart] Call Start Time
   * @param {String} [options.feedbackId] ID used for tracking
   * @param {String} [options.locusId]
   * @param {String} [options.correlationId]
   * @param {String} [options.meetingId] webex meeting ID
   * @param {String} [options.userId] userId
   * @param {String} [options.orgId] org id
   * @returns {String} feedback ID logs were submitted under
   */
  uploadLogs(
    options: {
      autoupload?: boolean;
      callStart?: string;
      feedbackId?: string;
      locussessionid?: string;
      locusId?: string;
      correlationId?: string;
      meetingId?: string;
      userId?: string;
      orgId?: string;
    } = {}
  ) {
    LoggerProxy.logger.info('Meetings:index#uploadLogs --> uploading logs');

    return this.loggerRequest
      .uploadLogs(options)
      .then((uploadResult) => {
        LoggerProxy.logger.info(
          'Meetings:index#uploadLogs --> Upload logs for meeting completed.',
          uploadResult
        );
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UPLOAD_LOGS_SUCCESS, options);
        Trigger.trigger(
          this,
          {
            file: 'meetings',
            function: 'uploadLogs',
          },
          EVENT_TRIGGERS.MEETING_LOG_UPLOAD_SUCCESS,
          {
            meetingId: options.meetingId,
            details: uploadResult,
          }
        );

        return uploadResult;
      })
      .catch((uploadError) => {
        LoggerProxy.logger.error(
          'Meetings:index#uploadLogs --> Unable to upload logs for meeting',
          uploadError
        );
        Trigger.trigger(
          this,
          {
            file: 'meetings',
            function: 'uploadLogs',
          },
          EVENT_TRIGGERS.MEETING_LOG_UPLOAD_FAILURE,
          {
            meetingId: options.meetingId,
            reason: uploadError,
          }
        );

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.UPLOAD_LOGS_FAILURE, {
          ...options,
          reason: uploadError.message,
          stack: uploadError.stack,
          code: uploadError.code,
        });
      });
  }

  /**
   * gets the reachability instance for Meetings
   * @returns {Reachability}
   * @public
   * @memberof Meetings
   */
  getReachability() {
    return this.reachability;
  }

  /**
   * initializes and starts gathering reachability for Meetings
   * @returns {Promise}
   * @public
   * @memberof Meetings
   */
  startReachability() {
    return this.getReachability().gatherReachability();
  }

  /**
   * Get geoHint for info for meetings
   * @returns {Promise}
   * @private
   * @memberof Meetings
   */
  getGeoHint() {
    return this.request.fetchGeoHint().then((res) => {
      this.geoHintInfo = res;
    });
  }

  /**
   * Fetch user preferred webex site information
   * This also has other infomation about the user
   * @returns {Promise}
   * @private
   * @memberof Meetings
   */
  fetchUserPreferredWebexSite() {
    return this.request.getMeetingPreferences().then((res) => {
      if (res) {
        const preferredWebexSite = MeetingsUtil.parseDefaultSiteFromMeetingPreferences(res);
        this.preferredWebexSite = preferredWebexSite;
        // @ts-ignore
        this.webex.internal.services._getCatalog().addAllowedDomains([preferredWebexSite]);
      }

      // fall back to getting the preferred site from the user information
      if (!this.preferredWebexSite) {
        // @ts-ignore
        return this.webex.internal.user
          .get()
          .then((user) => {
            const preferredWebexSite =
              user?.userPreferences?.userPreferencesItems?.preferredWebExSite;
            if (preferredWebexSite) {
              this.preferredWebexSite = preferredWebexSite;
              // @ts-ignore
              this.webex.internal.services._getCatalog().addAllowedDomains([preferredWebexSite]);
            } else {
              throw new Error('site not found');
            }
          })
          .catch(() => {
            LoggerProxy.logger.error(
              'Failed to fetch preferred site from user - no site will be set'
            );
          });
      }

      return Promise.resolve();
    });
  }

  /**
   * gets the personal meeting room instance, for saved PMR values for this user
   * @returns {PersonalMeetingRoom}
   * @public
   * @memberof Meetings
   */

  getPersonalMeetingRoom() {
    return this.personalMeetingRoom;
  }

  /**
   * @param {Meeting} meeting
   * @param {Object} reason
   * @param {String} type
   * @returns {Undefined}
   * @private
   * @memberof Meetings
   */
  private destroy(meeting: Meeting, reason: object) {
    MeetingUtil.cleanUp(meeting);
    this.meetingCollection.delete(meeting.id);
    Trigger.trigger(
      this,
      {
        file: 'meetings',
        function: 'destroy',
      },
      EVENT_TRIGGERS.MEETING_REMOVED,
      {
        meetingId: meeting.id,
        reason,
      }
    );
  }

  /**
   * Create a meeting or return an existing meeting.
   *
   * When meeting info passed it should be complete, e.g.: fetched after password or captcha provided
   *
   * @param {string} destination - sipURL, phonenumber, or locus object}
   * @param {DESTINATION_TYPE} [type] - the optional specified type, such as locusId
   * @param {Boolean} useRandomDelayForInfo - whether a random delay should be added to fetching meeting info
   * @param {Object} infoExtraParams extra parameters to be provided when fetching meeting info
   * @param {string} correlationId - the optional specified correlationId (callStateForMetrics.correlationId can be provided instead)
   * @param {Boolean} failOnMissingMeetingInfo - whether to throw an error if meeting info fails to fetch (for calls that are not 1:1 or content share)
   * @param {CallStateForMetrics} callStateForMetrics - information about call state for metrics
   * @param {Object} [meetingInfo] - Pre-fetched complete meeting info
   * @param {String} [meetingLookupUrl] - meeting info prefetch url
   * @returns {Promise<Meeting>} A new Meeting.
   * @public
   * @memberof Meetings
   */
  public create(
    destination: string,
    type: DESTINATION_TYPE = null,
    useRandomDelayForInfo = false,
    infoExtraParams = {},
    correlationId: string = undefined,
    failOnMissingMeetingInfo = false,
    callStateForMetrics: CallStateForMetrics = undefined,
    meetingInfo = undefined,
    meetingLookupUrl = undefined
  ) {
    // Validate meeting information based on the provided destination and
    // type. This must be performed prior to determining if the meeting is
    // found in the collection, as we mutate the destination for hydra person
    // id values.

    if (correlationId) {
      callStateForMetrics = {...(callStateForMetrics || {}), correlationId};
    }

    return (
      this.meetingInfo
        .fetchInfoOptions(destination, type)
        // Catch a failure to fetch info options.
        .catch((error) => {
          LoggerProxy.logger.error(
            `Meetings:index#create --> ERROR, unable to determine info options: ${error.message}`
          );
          if (error instanceof SpaceIDDeprecatedError) {
            throw new SpaceIDDeprecatedError();
          }
        })
        .then((options: any = {}) => {
          // Normalize the destination.
          const targetDest = options.destination || destination;

          // check for the conversation URL then sip Url
          let meeting = null;

          if (
            type === DESTINATION_TYPE.CONVERSATION_URL ||
            options.type === DESTINATION_TYPE.CONVERSATION_URL
          ) {
            const foundMeeting = this.meetingCollection.getByKey(
              MEETING_KEY.CONVERSATION_URL,
              targetDest
            );

            if (foundMeeting) {
              const foundMeetingIsNotCalendarMeeting = !foundMeeting.locusInfo.scheduledMeeting;

              // If the found meeting is not a calendar meeting, return that meeting.
              // This allows for the creation of instant-meetings when calendar meetings are present.
              if (foundMeetingIsNotCalendarMeeting) {
                meeting = foundMeeting;
              }
            }
          }

          // Attempt to collect the meeting if it exists.
          if (!meeting) {
            meeting = this.meetingCollection.getByKey(MEETING_KEY.SIP_URI, targetDest);
          }

          // Validate if a meeting was found.
          if (!meeting) {
            // Create a meeting based on the normalized destination and type.
            return this.createMeeting(
              targetDest,
              type,
              useRandomDelayForInfo,
              infoExtraParams,
              callStateForMetrics,
              failOnMissingMeetingInfo,
              meetingInfo,
              meetingLookupUrl
            ).then((createdMeeting: any) => {
              // If the meeting was successfully created.
              if (createdMeeting && createdMeeting.on) {
                // Create a destruction event for the meeting.
                createdMeeting.on(EVENTS.DESTROY_MEETING, (payload) => {
                  // @ts-ignore
                  if (this.config.autoUploadLogs) {
                    this.uploadLogs({
                      callStart: createdMeeting.locusInfo?.fullState?.lastActive,
                      locussessionid: createdMeeting.locusInfo?.fullState?.sessionId,
                      correlationId: createdMeeting.correlationId,
                      feedbackId: createdMeeting.correlationId,
                      locusId: createdMeeting.locusId,
                      meetingId: createdMeeting.locusInfo?.info?.webExMeetingId,
                      autoupload: true,
                    }).then(() => this.destroy(createdMeeting, payload.reason));
                  } else {
                    this.destroy(createdMeeting, payload.reason);
                  }
                });

                createdMeeting.on(EVENTS.REQUEST_UPLOAD_LOGS, (meetingInstance) => {
                  // @ts-ignore
                  if (this.config.autoUploadLogs) {
                    this.uploadLogs({
                      callStart: meetingInstance?.locusInfo?.fullState?.lastActive,
                      locussessionid: meetingInstance?.locusInfo?.fullState?.sessionId,
                      correlationId: meetingInstance.correlationId,
                      feedbackId: meetingInstance.correlationId,
                      locusId: meetingInstance.locusId,
                      meetingId: meetingInstance.locusInfo?.info?.webExMeetingId,
                      autoupload: true,
                    });
                  }
                });
              } else {
                LoggerProxy.logger.error(
                  `Meetings:index#create --> ERROR, meeting does not have on method, will not be destroyed, meeting cleanup impossible for meeting: ${meeting}`
                );
              }

              // Return the newly created meeting.
              return Promise.resolve(createdMeeting);
            });
          }
          meeting.setCallStateForMetrics(callStateForMetrics);

          // Return the existing meeting.
          return Promise.resolve(meeting);
        })
    );
  }

  /**
   * Create meeting
   *
   * When meeting info passed it should be complete, e.g.: fetched after password or captcha provided
   *
   * @param {String} destination see create()
   * @param {DESTINATION_TYPE} type see create()
   * @param {Boolean} useRandomDelayForInfo whether a random delay should be added to fetching meeting info
   * @param {Object} infoExtraParams extra parameters to be provided when fetching meeting info
   * @param {CallStateForMetrics} callStateForMetrics - information about call state for metrics
   * @param {Boolean} failOnMissingMeetingInfo - whether to throw an error if meeting info fails to fetch (for calls that are not 1:1 or content share)
   * @param {Object} [meetingInfo] - Pre-fetched complete meeting info
   * @param {String} [meetingLookupUrl] - meeting info prefetch url
   * @returns {Promise} a new meeting instance complete with meeting info and destination
   * @private
   * @memberof Meetings
   */
  private async createMeeting(
    destination: any,
    type: DESTINATION_TYPE = null,
    useRandomDelayForInfo = false,
    infoExtraParams = {},
    callStateForMetrics: CallStateForMetrics = undefined,
    failOnMissingMeetingInfo = false,
    meetingInfo = undefined,
    meetingLookupUrl = undefined
  ) {
    const meeting = new Meeting(
      {
        // @ts-ignore
        userId: this.webex.internal.device.userId,
        // @ts-ignore
        deviceUrl: this.webex.internal.device.url,
        // @ts-ignore
        orgId: this.webex.internal.device.orgId,
        locus: type === DESTINATION_TYPE.LOCUS_ID ? destination : null, // pass the locus object if present
        meetingInfoProvider: this.meetingInfo,
        destination,
        destinationType: type,
        callStateForMetrics,
      },
      {
        // @ts-ignore
        parent: this.webex,
      }
    );

    this.meetingCollection.set(meeting);

    try {
      // if no participant has joined the scheduled meeting (meaning meeting is not active) and we get a locusEvent,
      // it means the meeting will start in 5-6 min. In that case, we want to fetchMeetingInfo
      // between 5 and 2 min (random between 3 minutes) before the meeting starts
      // to avoid a spike in traffic to the wbxappi service
      let waitingTime = 0;

      if (destination.meeting) {
        const {startTime} = destination.meeting;
        const startTimeDate = new Date(startTime);
        const startTimeDatestamp = startTimeDate.getTime();
        const timeToStart = startTimeDatestamp - Date.now();
        const maxWaitingTime = Math.max(
          Math.min(timeToStart, MAX_RANDOM_DELAY_FOR_MEETING_INFO),
          0
        );

        waitingTime = Math.round(Math.random() * maxWaitingTime);
      }
      const isMeetingActive = !!destination.fullState?.active;
      // @ts-ignore
      const {enableUnifiedMeetings} = this.config.experimental;
      const meetingInfoOptions = {
        extraParams: infoExtraParams,
        sendCAevents: !!callStateForMetrics?.correlationId, // if client sends correlation id as argument of public create(), then it means that this meeting creation is part of a pre-join intent from user
      };

      if (meetingInfo) {
        meeting.injectMeetingInfo(meetingInfo, meetingInfoOptions, meetingLookupUrl);
      } else if (type !== DESTINATION_TYPE.ONE_ON_ONE_CALL) {
        // ignore fetchMeetingInfo for 1:1 meetings
        if (enableUnifiedMeetings && !isMeetingActive && useRandomDelayForInfo && waitingTime > 0) {
          meeting.fetchMeetingInfoTimeoutId = setTimeout(
            () => meeting.fetchMeetingInfo(meetingInfoOptions),
            waitingTime
          );
          meeting.parseMeetingInfo(undefined, destination);
        } else {
          await meeting.fetchMeetingInfo(meetingInfoOptions);
        }
      }
    } catch (err) {
      if (
        !(err instanceof CaptchaError) &&
        !(err instanceof PasswordError) &&
        !(err instanceof PermissionError)
      ) {
        LoggerProxy.logger.info(
          `Meetings:index#createMeeting --> Info Unable to fetch meeting info for ${destination}.`
        );
        if (failOnMissingMeetingInfo) {
          LoggerProxy.logger.info(
            `Meetings:index#createMeeting --> Destroying meeting due to missing meeting info.`
          );
          // @ts-ignore
          this.destroy(meeting, MEETING_REMOVED_REASON.MISSING_MEETING_INFO);
          throw new NoMeetingInfoError();
        }
        // if there is no meeting info and no error should be thrown then we assume its a 1:1 call or wireless share
        LoggerProxy.logger.info(
          'Meetings:index#createMeeting --> Info assuming this destination is a 1:1 or wireless share'
        );
      }
      LoggerProxy.logger.debug(
        `Meetings:index#createMeeting --> Debug ${err} fetching /meetingInfo for creation.`
      );
    } finally {
      // For type LOCUS_ID we need to parse the locus object to get the information
      // about the caller and callee
      // Meeting Added event will be created in `handleLocusEvent`
      if (type !== DESTINATION_TYPE.LOCUS_ID) {
        if (!meeting.sipUri) {
          meeting.setSipUri(destination);
        }

        // TODO: check if we have to move this to parser
        const meetingAddedType = MeetingsUtil.getMeetingAddedType(type);

        // We typically shouldn't need to trigger both and event and return a promise.
        // Is this a special case? We want to make the public API usage as simple as possible.
        Trigger.trigger(
          this,
          {
            file: 'meetings',
            function: 'createMeeting',
          },
          EVENT_TRIGGERS.MEETING_ADDED,
          {
            meeting,
            type: meetingAddedType,
          }
        );
      }
    }

    return meeting;

    // Create the meeting calling the necessary service endpoints.

    // Internally, there are many more destinations:
    //
    // - locusID
    // - meetingURL
    // - globalMeetingID, e.g, *00*meetingID
    // - meetingID
    // - meetingURL
    // - PSTN
    // - phone number
    //
    // Our job is to determine the appropriate one
    // and its corresponding service so that developers
    // need only sipURL to get a meeting
    // and its ID, but have the option to use createWithType()
    // and specify those types to get meetingInfo
  }

  /**
   * get a specifc meeting given it's type matched to the value, i.e., locus url
   * @param {String} type
   * @param {Object} value
   * @returns {Meeting}
   * @public
   * @memberof Meetings
   */
  public getMeetingByType(type: string, value: object) {
    return this.meetingCollection.getByKey(type, value);
  }

  /**
   * Get all meetings.
   * @returns {Object} All currently active meetings.
   * @public
   * @memberof Meetings
   */
  public getAllMeetings() {
    return this.meetingCollection.getAll();
  }

  /**
   * Syncs all the meetings from server. Does nothing and returns immediately if unverified guest.
   * @param {boolean} keepOnlyLocusMeetings - whether the sync should keep only locus meetings or any other meeting in meetingCollection
   * @returns {Promise<void>}
   * @public
   * @memberof Meetings
   */
  public syncMeetings({keepOnlyLocusMeetings = true} = {}): Promise<void> {
    // @ts-ignore
    if (this.webex.credentials.isUnverifiedGuest) {
      LoggerProxy.logger.info(
        'Meetings:index#syncMeetings --> skipping meeting sync as unverified guest'
      );

      return Promise.resolve();
    }

    return this.request
      .getActiveMeetings()
      .then((locusArray) => {
        const activeLocusUrl = [];

        if (locusArray?.loci && locusArray.loci.length > 0) {
          const lociToUpdate = this.sortLocusArrayToUpdate(locusArray.loci);
          lociToUpdate.forEach((locus) => {
            activeLocusUrl.push(locus.url);
            this.handleLocusEvent({
              locus,
              locusUrl: locus.url,
            });
          });
        }
        const meetingsCollection = this.meetingCollection.getAll();

        if (Object.keys(meetingsCollection).length > 0) {
          // Sometimes the mercury events are lost after mercury reconnect
          // Remove any Locus meetings that are not returned by Locus
          // (they had a locusUrl previously but are no longer active) in the sync
          for (const meeting of Object.values(meetingsCollection)) {
            // @ts-ignore
            const {locusUrl} = meeting;
            if ((keepOnlyLocusMeetings || locusUrl) && !activeLocusUrl.includes(locusUrl)) {
              // destroy function also uploads logs
              // @ts-ignore
              this.destroy(meeting, MEETING_REMOVED_REASON.NO_MEETINGS_TO_SYNC);
            }
          }
        }
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `Meetings:index#syncMeetings --> failed to sync meetings, ${error}`
        );
        throw new Error(error);
      });
  }

  /**
   * sort out locus array for initial creating
   * @param {Array} loci original locus array
   * @returns {undefined}
   * @public
   * @memberof Meetings
   */
  sortLocusArrayToUpdate(loci: any[]) {
    const mainLoci = loci.filter((locus) => !MeetingsUtil.isBreakoutLocusDTO(locus));
    const breakoutLoci = loci.filter((locus) => MeetingsUtil.isValidBreakoutLocus(locus));
    this.breakoutLocusForHandleLater = [];
    const lociToUpdate = [...mainLoci];
    breakoutLoci.forEach((breakoutLocus) => {
      const associateMainLocus = mainLoci.find(
        (mainLocus) => mainLocus.controls?.breakout?.url === breakoutLocus.controls?.breakout?.url
      );
      const existCorrespondingMeeting = this.getCorrespondingMeetingByLocus({
        locus: breakoutLocus,
        locusUrl: breakoutLocus.url,
      });

      if (associateMainLocus && !existCorrespondingMeeting) {
        // if exists both main session and breakout session locus of the same non-exist meeting, handle main locus first,
        // after meeting create with main locus, then handle the associate breakout locus.
        // if only handle breakout locus, will miss some date
        this.breakoutLocusForHandleLater.push(breakoutLocus);
      } else {
        lociToUpdate.push(breakoutLocus);
      }
    });

    return lociToUpdate;
  }

  /**
   * check breakout locus which waiting for main locus's meeting to be created, then handle the breakout locus
   * @param {Object} newCreatedLocus the locus which just create meeting object of it
   * @returns {undefined}
   * @public
   * @memberof Meetings
   */
  checkHandleBreakoutLocus(newCreatedLocus) {
    if (
      !newCreatedLocus ||
      !this.breakoutLocusForHandleLater ||
      !this.breakoutLocusForHandleLater.length
    ) {
      return;
    }
    if (MeetingsUtil.isBreakoutLocusDTO(newCreatedLocus)) {
      return;
    }
    const existIndex = this.breakoutLocusForHandleLater.findIndex(
      (breakoutLocus) =>
        breakoutLocus.controls?.breakout?.url === newCreatedLocus.controls?.breakout?.url
    );

    if (existIndex < 0) {
      return;
    }

    const associateBreakoutLocus = this.breakoutLocusForHandleLater[existIndex];
    this.handleLocusEvent({locus: associateBreakoutLocus, locusUrl: associateBreakoutLocus.url});
    this.breakoutLocusForHandleLater.splice(existIndex, 1);
  }

  /**
   * Get the logger instance for plugin-meetings
   * @returns {Logger}
   */
  getLogger() {
    return LoggerProxy.get();
  }

  /**
   * Returns the first meeting it finds that has the webrtc media connection created.
   * Useful for debugging in the console.
   *
   * @private
   * @returns {Meeting} Meeting object that has a webrtc media connection, else undefined
   */
  getActiveWebrtcMeeting() {
    return this.meetingCollection.getActiveWebrtcMeeting();
  }
}
