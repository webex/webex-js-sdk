/* globals window */

import {
  _LOCUS_ID_,
  _INCOMING_,
  _CREATED_,
  LOCUSEVENT,
  CORRELATION_ID,
  EVENT_TRIGGERS,
} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';

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

MeetingsUtil.getMeetingAddedType = (type) => (type === _LOCUS_ID_ ? _INCOMING_ : _CREATED_);

MeetingsUtil.handleRoapMercury = (envelope, meetingCollection) => {
  const {data} = envelope;
  const {eventType} = data;

  if (eventType === LOCUSEVENT.MESSAGE_ROAP) {
    const meeting = meetingCollection.getByKey(CORRELATION_ID, data.correlationId);

    if (meeting) {
      meeting.roap.roapEvent(data);
    }
  }
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

  if (userPreferences && userPreferences.sites) {
    const defaultSite = userPreferences.sites.find((site) => site.default);

    if (defaultSite) {
      result = defaultSite.siteUrl;
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

export default MeetingsUtil;
