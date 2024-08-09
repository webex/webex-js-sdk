/* globals window */

import {
  _CREATED_,
  _INCOMING_,
  _JOINED_,
  _LEFT_,
  DESTINATION_TYPE,
  _MOVED_,
  BREAKOUTS,
  EVENT_TRIGGERS,
  LOCUS,
  LOCUSEVENT,
  ROAP,
} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';
import {MEETING_KEY} from './meetings.types';

/**
 * Meetings Media Codec Missing Event
 * Emitted when H.264 codec is not
 * found in the browser.
 * @event media:codec:missing
 * @instance
 * @memberof MeetingsUtil
 */

/**
 * Meetings Media Codec Loaded Event
 * Emitted when H.264 codec has been
 * loaded in the browser.
 * @event media:codec:loaded
 * @instance
 * @memberof MeetingsUtil
 */

const MeetingsUtil: any = {};

MeetingsUtil.getMeetingAddedType = (type: DESTINATION_TYPE) =>
  type === DESTINATION_TYPE.LOCUS_ID ? _INCOMING_ : _CREATED_;

MeetingsUtil.handleRoapMercury = (envelope, meetingCollection) => {
  const {data} = envelope;
  const {eventType} = data;

  if (eventType === LOCUSEVENT.MESSAGE_ROAP) {
    const meeting = meetingCollection.getByKey(MEETING_KEY.CORRELATION_ID, data.correlationId);

    if (meeting) {
      const {seq, messageType, tieBreaker, errorType, errorCause} = data.message;

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ROAP_MERCURY_EVENT_RECEIVED, {
        correlation_id: data.correlationId,
        seq,
        message_type: messageType,
        error_type: errorType,
        error_cause: errorCause,
      });

      if (messageType === ROAP.ROAP_TYPES.TURN_DISCOVERY_RESPONSE) {
        // turn discovery is not part of normal roap protocol and so we are not handling it
        // through the usual roap state machine
        meeting.roap.turnDiscovery.handleTurnDiscoveryResponse(data.message, 'from mercury');
      } else {
        const roapMessage = {
          seq,
          messageType,
          sdp: data.message.sdps?.length > 0 ? data.message.sdps[0] : undefined,
          tieBreaker,
          errorType,
          errorCause,
        };

        meeting.roapMessageReceived(roapMessage);
      }
    }
  }
};

MeetingsUtil.getMediaServer = (sdp) => {
  let mediaServer;

  // Attempt to collect the media server from the roap message.
  try {
    mediaServer = sdp
      .split('\r\n')
      .find((line) => line.startsWith('o='))
      .split(' ')
      .shift()
      .replace('o=', '');
  } catch {
    mediaServer = undefined;
  }

  return mediaServer;
};

MeetingsUtil.checkForCorrelationId = (deviceUrl, locus) => {
  let devices = [];

  if (locus) {
    if (locus && locus.self && locus.self.devices) {
      devices = locus.self.devices;
    }

    const foundDevice = devices.find((device) => device.url === deviceUrl);

    if (foundDevice && foundDevice.correlationId) {
      return foundDevice.correlationId;
    }
  }

  return false;
};

MeetingsUtil.parseDefaultSiteFromMeetingPreferences = (userPreferences) => {
  let result = '';

  if (userPreferences?.sites?.length) {
    const defaultSite = userPreferences.sites.find((site) => site.default);

    if (defaultSite) {
      result = defaultSite.siteUrl;
    } else {
      result = userPreferences.sites[0].siteUrl;
    }
  }

  return result;
};

/**
 * Will check to see if the H.264 media codec is supported.
 * @async
 * @private
 * @returns {Promise<boolean>}
 */
MeetingsUtil.hasH264Codec = async () => {
  let hasCodec = false;

  try {
    const pc = new window.RTCPeerConnection();
    const offer = await pc.createOffer({offerToReceiveVideo: true});

    if (offer.sdp.match(/^a=rtpmap:\d+\s+H264\/\d+/m)) {
      hasCodec = true;
    }
    pc.close();
  } catch (error) {
    LoggerProxy.logger.warn(
      'Meetings:util#hasH264Codec --> Error creating peerConnection for H.264 test.'
    );
  }

  return hasCodec;
};

/**
 * Notifies the user whether or not the H.264
 * codec is present. Will continuously check
 * until max duration.
 * @async
 * @private
 * @param {object} options
 * @param {Number} options.firstChecked Timestamp in milliseconds
 * @param {boolean} options.disableNotifications Default is false. Boolean to enable/disable notification and events
 * @returns {undefined}
 */
MeetingsUtil.checkH264Support = async function checkH264Support(options: {
  firstChecked: number;
  disableNotifications: boolean;
}) {
  const {hasH264Codec} = MeetingsUtil;
  const {firstChecked, disableNotifications} = options || {};
  const delay = 5e3; // ms
  const maxDuration = 3e5; // ms
  const shouldTrigger = firstChecked === undefined;
  const shouldStopChecking = firstChecked && Date.now() - firstChecked >= maxDuration;

  // Disable notifications and start H.264 download only
  if (disableNotifications) {
    hasH264Codec();

    return;
  }

  // Codec loaded trigger event notification
  if (await hasH264Codec()) {
    Trigger.trigger(
      this,
      {
        file: 'meetings/util',
        function: 'checkH264Support',
      },
      EVENT_TRIGGERS.MEDIA_CODEC_LOADED
    );
    LoggerProxy.logger.log('Meetings:util#checkH264Support --> H264 codec loaded successfully.');

    return;
  }

  // Stop checking if past the timelimit
  if (shouldStopChecking) {
    LoggerProxy.logger.error(
      'Meetings:util#checkH264Support --> Timed out waiting for H264 codec to load.'
    );

    return;
  }

  // Trigger only once
  if (shouldTrigger) {
    Trigger.trigger(
      this,
      {
        file: 'meetings/util',
        function: 'checkH264Support',
      },
      EVENT_TRIGGERS.MEDIA_CODEC_MISSING
    );
    LoggerProxy.logger.log('Meetings:util#checkH264Support --> H264 codec is missing.');
  }

  // Keep checking in intervals to see if codec loaded
  window.setTimeout(() => {
    const timestamp = firstChecked || Date.now();

    MeetingsUtil.checkH264Support.call(this, {firstChecked: timestamp});
  }, delay);
};

/**
 * get device from locus data
 * @param {Object} newLocus new locus data
 * @param {String} deviceUrl current device url
 * @returns {Object}
 */
MeetingsUtil.getThisDevice = (newLocus: any, deviceUrl: string) => {
  if (newLocus?.self?.devices?.length > 0) {
    return newLocus.self.devices.find((device) => device.url === deviceUrl);
  }

  return null;
};

/**
 * get self device joined status from locus data
 * @param {Object} meeting current meeting data
 * @param {Object} newLocus new locus data
 * @param {String} deviceUrl current device url
 * @returns {Object}
 */
MeetingsUtil.joinedOnThisDevice = (meeting: any, newLocus: any, deviceUrl: string) => {
  const thisDevice = MeetingsUtil.getThisDevice(newLocus, deviceUrl);
  if (thisDevice) {
    if (!thisDevice.correlationId || meeting?.correlationId === thisDevice.correlationId) {
      return (
        thisDevice.state === _JOINED_ ||
        (thisDevice.state === _LEFT_ && thisDevice.reason === _MOVED_)
      );
    }
  }

  return false;
};

/**
 * check the new locus is breakout session's one or not
 * @param {Object} newLocus new locus data
 * @returns {boolean}
 * @private
 */
MeetingsUtil.isBreakoutLocusDTO = (newLocus: any) => {
  return newLocus?.controls?.breakout?.sessionType === BREAKOUTS.SESSION_TYPES.BREAKOUT;
};

/**
 * check the locus is valid breakout locus or not
 * @param {Object} locus
 * @returns {boolean}
 * @private
 */
MeetingsUtil.isValidBreakoutLocus = (locus: any) => {
  const inActiveStatus = locus?.fullState?.state === LOCUS.STATE.INACTIVE;
  const isLocusAsBreakout = MeetingsUtil.isBreakoutLocusDTO(locus);
  const selfJoined = locus.self?.state === _JOINED_;

  return isLocusAsBreakout && !inActiveStatus && selfJoined;
};
export default MeetingsUtil;
