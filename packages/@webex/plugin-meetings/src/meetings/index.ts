/* eslint no-shadow: ["error", { "allow": ["eventType"] }] */

import '@webex/internal-plugin-mercury';
// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import 'webrtc-adapter';

import Metrics from '../metrics';
import {trigger, eventType} from '../metrics/config';
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
  LOCUS_URL,
  MAX_RANDOM_DELAY_FOR_MEETING_INFO,
  ROAP,
  ONLINE,
  OFFLINE,
  _MEETING_,
  _JOIN_,
  _LOCUS_ID_,
  _INCOMING_,
  LOCUS,
  CORRELATION_ID,
  SIP_URI,
  _LEFT_,
  _ID_,
  MEETING_REMOVED_REASON,
  _CONVERSATION_URL_,
  CONVERSATION_URL,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import MeetingInfo from '../meeting-info';
import MeetingInfoV2 from '../meeting-info/meeting-info-v2';
import Meeting from '../meeting';
import PersonalMeetingRoom from '../personal-meeting-room';
import Reachability from '../reachability';
import Request from './request';
import PasswordError from '../common/errors/password-error';
import CaptchaError from '../common/errors/captcha-error';

import MeetingCollection from './collection';
import MeetingsUtil from './util';

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
  reachability: any;
  registered: any;
  request: any;
  geoHintInfo: any;
  meetingInfo: any;

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
     * The Reachability object to interact with server, starts as null until {@link Meeting#setReachability} is called
     * starts as null
     * @instance
     * @type {Object}
     * @private
     * @memberof Meetings
     */
    this.reachability = null;

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
      getSupportedDevice: Media.getSupportedDevice,
    };

    this.onReady();
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
    let meeting = null;

    // getting meeting by correlationId. This will happen for the new event
    // Either the locus
    // TODO : Add check for the callBack Address
    meeting =
      this.meetingCollection.getByKey(LOCUS_URL, data.locusUrl) ||
      // @ts-ignore
      this.meetingCollection.getByKey(
        CORRELATION_ID,
        // @ts-ignore
        MeetingsUtil.checkForCorrelationId(this.webex.internal.device.url, data.locus)
      ) ||
      this.meetingCollection.getByKey(
        SIP_URI,
        data.locus.self &&
          data.locus.self.callbackInfo &&
          data.locus.self.callbackInfo.callbackAddress
      ) ||
      (data.locus.info?.isUnifiedSpaceMeeting
        ? undefined
        : this.meetingCollection.getByKey(CONVERSATION_URL, data.locus.conversationUrl));

    // Special case when locus has got replaced, This only happend once if a replace locus exists
    // https://sqbu-github.cisco.com/WebExSquared/locus/wiki/Locus-changing-mid-call

    if (!meeting && data.locus?.replaces?.length > 0) {
      // Always the last element in the replace is the active one
      meeting = this.meetingCollection.getByKey(
        LOCUS_URL,
        data.locus.replaces[data.locus.replaces.length - 1].locusUrl
      );
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

      this.create(data.locus, _LOCUS_ID_, useRandomDelayForInfo)
        .then((newMeeting) => {
          meeting = newMeeting;

          // It's a new meeting so initialize the locus data
          meeting.locusInfo.initialSetup(data.locus);
        })
        .catch((e) => {
          LoggerProxy.logger.error(e);
        })
        .finally(() => {
          // There will be cases where locus event comes in gets created and deleted because its a 1:1 and meeting gets deleted
          // because the other user left so before sending 'added' event make sure it exists in the collection

          if (this.getMeetingByType(_ID_, meeting.id)) {
            Metrics.postEvent({
              event: eventType.REMOTE_STARTED,
              meeting,
              data: {trigger: trigger.MERCURY_EVENT},
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
      this.syncMeetings();
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
      Metrics.initialSetup(this.meetingCollection, this.webex);
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
   * API to enable or disable TURN discovery
   * @param {Boolean} enable
   * @private
   * @memberof Meetings
   * @returns {undefined}
   */
  private _toggleTurnDiscovery(enable: boolean) {
    if (typeof enable !== 'boolean') {
      return;
    }
    // @ts-ignore
    this.config.experimental.enableTurnDiscovery = enable;
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
      callStart?: string;
      feedbackId?: string;
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
          // @ts-ignore - seems like typo
          meetingId: options.meetingsId,
          reason: uploadError.message,
          stack: uploadError.stack,
          code: uploadError.code,
        });
      });
  }

  /**
   * initializes the reachability instance for Meetings
   * @returns {undefined}
   * @public
   * @memberof Meetings
   */
  setReachability() {
    // @ts-ignore
    this.reachability = new Reachability(this.webex);
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
    if (!this.reachability) {
      this.setReachability();
    }

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
        this.preferredWebexSite = MeetingsUtil.parseDefaultSiteFromMeetingPreferences(res);
      }
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
   * Create a meeting.
   * @param {string} destination - sipURL, spaceId, phonenumber, or locus object}
   * @param {string} [type] - the optional specified type, such as locusId
   * @param {Boolean} useRandomDelayForInfo - whether a random delay should be added to fetching meeting info
   * @returns {Promise<Meeting>} A new Meeting.
   * @public
   * @memberof Meetings
   */
  public create(destination: string, type: string = null, useRandomDelayForInfo = false) {
    // TODO: type should be from a dictionary

    // Validate meeting information based on the provided destination and
    // type. This must be performed prior to determining if the meeting is
    // found in the collection, as we mutate the destination for hydra person
    // id values.
    return (
      this.meetingInfo
        .fetchInfoOptions(destination, type)
        // Catch a failure to fetch info options.
        .catch((error) => {
          LoggerProxy.logger.info(
            `Meetings:index#create --> INFO, unable to determine info options: ${error.message}`
          );
        })
        .then((options: any = {}) => {
          // Normalize the destination.
          const targetDest = options.destination || destination;

          // check for the conversation URL then sip Url
          let meeting = null;

          if (type === _CONVERSATION_URL_ || options.type === _CONVERSATION_URL_) {
            const foundMeeting = this.meetingCollection.getByKey(CONVERSATION_URL, targetDest);

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
            meeting = this.meetingCollection.getByKey(SIP_URI, targetDest);
          }

          // Validate if a meeting was found.
          if (!meeting) {
            // Create a meeting based on the normalized destination and type.
            return this.createMeeting(targetDest, type, useRandomDelayForInfo).then(
              (createdMeeting: any) => {
                // If the meeting was successfully created.
                if (createdMeeting && createdMeeting.on) {
                  // Create a destruction event for the meeting.
                  createdMeeting.on(EVENTS.DESTROY_MEETING, (payload) => {
                    // @ts-ignore
                    if (this.config.autoUploadLogs) {
                      this.uploadLogs({
                        callStart: createdMeeting.locusInfo?.fullState?.lastActive,
                        correlationId: createdMeeting.correlationId,
                        feedbackId: createdMeeting.correlationId,
                        locusId: createdMeeting.locusId,
                        meetingId: createdMeeting.locusInfo?.info?.webExMeetingId,
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
                        correlationId: meetingInstance.correlationId,
                        feedbackId: meetingInstance.correlationId,
                        locusId: meetingInstance.locusId,
                        meetingId: meetingInstance.locusInfo?.info?.webExMeetingId,
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
              }
            );
          }

          // Return the existing meeting.
          return Promise.resolve(meeting);
        })
    );
  }

  /**
   * @param {String} destination see create()
   * @param {String} type see create()
   * @param {Boolean} useRandomDelayForInfo whether a random delay should be added to fetching meeting info
   * @returns {Promise} a new meeting instance complete with meeting info and destination
   * @private
   * @memberof Meetings
   */
  private async createMeeting(
    destination: any,
    type: string = null,
    useRandomDelayForInfo = false
  ) {
    const meeting = new Meeting(
      {
        // @ts-ignore
        userId: this.webex.internal.device.userId,
        // @ts-ignore
        deviceUrl: this.webex.internal.device.url,
        // @ts-ignore
        orgId: this.webex.internal.device.orgId,
        roapSeq: 0,
        locus: type === _LOCUS_ID_ ? destination : null, // pass the locus object if present
        meetingInfoProvider: this.meetingInfo,
        destination,
        destinationType: type,
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

      if (enableUnifiedMeetings && !isMeetingActive && useRandomDelayForInfo && waitingTime > 0) {
        meeting.fetchMeetingInfoTimeoutId = setTimeout(
          () => meeting.fetchMeetingInfo({}),
          waitingTime
        );
        meeting.parseMeetingInfo(undefined, destination);
      } else {
        await meeting.fetchMeetingInfo({});
      }
    } catch (err) {
      if (!(err instanceof CaptchaError) && !(err instanceof PasswordError)) {
        // if there is no meeting info we assume its a 1:1 call or wireless share
        LoggerProxy.logger.info(
          `Meetings:index#createMeeting --> Info Unable to fetch meeting info for ${destination}.`
        );
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
      if (type !== _LOCUS_ID_) {
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
    // need only sipURL or spaceID to get a meeting
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
   * @param {object} options
   * @param {object} options.startDate - get meetings after this start date
   * @param {object} options.endDate - get meetings before this end date
   * @returns {Object} All currently active meetings.
   * @public
   * @memberof Meetings
   */
  public getAllMeetings(
    options: {
      startDate: object;
      endDate: object;
    } = {} as any
  ) {
    // Options may include other parameters to filter this collection
    // of meetings.
    return this.meetingCollection.getAll(options);
  }

  /**
   * syncs all the meeting from server
   * @returns {undefined}
   * @public
   * @memberof Meetings
   */
  public syncMeetings() {
    return this.request.getActiveMeetings().then((locusArray) => {
      const activeLocusUrl = [];

      if (locusArray?.loci && locusArray.loci.length > 0) {
        locusArray.loci.forEach((locus) => {
          activeLocusUrl.push(locus.url);
          this.handleLocusEvent({
            locus,
            locusUrl: locus.url,
          });
        });
      }
      const meetingsCollection = this.meetingCollection.getAll();

      if (Object.keys(meetingsCollection).length > 0) {
        // Some time the mercury event is missed after mercury reconnect
        // if sync returns no locus then clear all the meetings
        for (const meeting of Object.values(meetingsCollection)) {
          // @ts-ignore
          if (!activeLocusUrl.includes(meeting.locusUrl)) {
            // destroy function also uploads logs
            // @ts-ignore
            this.destroy(meeting, MEETING_REMOVED_REASON.NO_MEETINGS_TO_SYNC);
          }
        }
      }
    });
  }

  /**
   * Get all scheduled meetings.
   * @param {object} options
   * @param {object} options.startDate - get meetings after this start date
   * @param {object} options.endDate - get meetings before this end date
   * @returns {Object} All scheduled meetings.
   * @memberof Meetings
   */
  getScheduledMeetings() {
    return this.meetingCollection.getAll({scheduled: true});
  }

  /**
   * Get the logger instance for plugin-meetings
   * @returns {Logger}
   */
  getLogger() {
    return LoggerProxy.get();
  }
}
