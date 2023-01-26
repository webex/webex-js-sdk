import {isEmpty} from 'lodash';

import {MeetingNotActiveError, UserNotJoinedError} from '../common/errors/webex-errors';
import Metrics from '../metrics';
import {eventType, trigger} from '../metrics/config';
import Media from '../media';
import LoggerProxy from '../common/logs/logger-proxy';
import {
  INTENT_TO_JOIN,
  _LEFT_,
  _IDLE_,
  _JOINED_,
  PASSWORD_STATUS,
  DISPLAY_HINTS,
  FULL_STATE,
} from '../constants';
import IntentToJoinError from '../common/errors/intent-to-join';
import JoinMeetingError from '../common/errors/join-meeting';
import ParameterError from '../common/errors/parameter';
import PermissionError from '../common/errors/permission';
import PasswordError from '../common/errors/password-error';
import CaptchaError from '../common/errors/captcha-error';

const MeetingUtil: any = {};

MeetingUtil.parseLocusJoin = (response) => {
  const parsed: any = {};

  // First todo: add check for existance
  parsed.locus = response.body.locus;
  parsed.mediaConnections = response.body.mediaConnections;
  parsed.locusUrl = parsed.locus.url;
  parsed.locusId = parsed.locus.url.split('/').pop();
  parsed.selfId = parsed.locus.self.id;

  // we need mediaId before making roap calls
  parsed.mediaConnections.forEach((mediaConnection) => {
    if (mediaConnection.mediaId) {
      parsed.mediaId = mediaConnection.mediaId;
    }
  });

  return parsed;
};

MeetingUtil.remoteUpdateAudioVideo = (audioMuted, videoMuted, meeting) => {
  if (!meeting) {
    return Promise.reject(new ParameterError('You need a meeting object.'));
  }
  const localMedias = Media.generateLocalMedias(meeting.mediaId, audioMuted, videoMuted);

  if (isEmpty(localMedias)) {
    return Promise.reject(
      new ParameterError('You need a media id on the meeting to change remote audio.')
    );
  }

  Metrics.postEvent({event: eventType.MEDIA_REQUEST, meeting});

  return meeting.meetingRequest
    .remoteAudioVideoToggle({
      locusUrl: meeting.locusUrl,
      selfId: meeting.selfId,
      localMedias,
      deviceUrl: meeting.deviceUrl,
      correlationId: meeting.correlationId,
    })
    .then((response) => {
      Metrics.postEvent({event: eventType.MEDIA_RESPONSE, meeting});

      return response.body.locus;
    });
};

MeetingUtil.hasOwner = (info) => info && info.owner;

MeetingUtil.isOwnerSelf = (owner, selfId) => owner === selfId;

MeetingUtil.isPinOrGuest = (err) =>
  err?.body?.errorCode && INTENT_TO_JOIN.includes(err.body.errorCode);

MeetingUtil.joinMeeting = (meeting, options) => {
  if (!meeting) {
    return Promise.reject(new ParameterError('You need a meeting object.'));
  }

  Metrics.postEvent({event: eventType.LOCUS_JOIN_REQUEST, meeting});

  // eslint-disable-next-line no-warning-comments
  // TODO: check if the meeting is in JOINING state
  // if Joining state termintate the request as user might click multiple times
  return meeting.meetingRequest
    .joinMeeting({
      inviteeAddress: meeting.meetingJoinUrl || meeting.sipUri,
      meetingNumber: meeting.meetingNumber,
      deviceUrl: meeting.deviceUrl,
      locusUrl: meeting.locusUrl,
      correlationId: meeting.correlationId,
      roapMessage: options.roapMessage,
      permissionToken: meeting.permissionToken,
      resourceId: options.resourceId || null,
      moderator: options.moderator,
      pin: options.pin,
      moveToResource: options.moveToResource,
      preferTranscoding: options.preferTranscoding,
      asResourceOccupant: options.asResourceOccupant,
    })
    .then((res) => {
      Metrics.postEvent({
        event: eventType.LOCUS_JOIN_RESPONSE,
        meeting,
        data: {
          trigger: trigger.LOCI_UPDATE,
          locus: res.body.locus,
          mediaConnections: res.body.mediaConnections,
          trackingId: res.headers.trackingid,
        },
      });

      return MeetingUtil.parseLocusJoin(res);
    });
};

MeetingUtil.cleanUp = (meeting) => {
  // make sure we send last metrics before we close the peerconnection
  const stopStatsAnalyzer = meeting.statsAnalyzer
    ? meeting.statsAnalyzer.stopAnalyzer()
    : Promise.resolve();

  return stopStatsAnalyzer
    .then(() => meeting.closeLocalStream())
    .then(() => meeting.closeLocalShare())
    .then(() => meeting.closeRemoteTracks())
    .then(() => meeting.closePeerConnections())
    .then(() => {
      meeting.unsetLocalVideoTrack();
      meeting.unsetLocalShareTrack();
      meeting.unsetRemoteTracks();
      meeting.unsetPeerConnections();
      meeting.reconnectionManager.cleanUp();
    })
    .then(() => meeting.roap.stop(meeting.correlationId, meeting.roapSeq))
    .then(() => meeting.stopKeepAlive());
};

MeetingUtil.disconnectPhoneAudio = (meeting, phoneUrl) => {
  if (meeting.meetingState === FULL_STATE.INACTIVE) {
    return Promise.reject(new MeetingNotActiveError());
  }

  const options = {
    locusUrl: meeting.locusUrl,
    selfId: meeting.selfId,
    correlationId: meeting.correlationId,
    phoneUrl,
  };

  return meeting.meetingRequest
    .disconnectPhoneAudio(options)
    .then((response) => {
      if (response?.body?.locus) {
        meeting.locusInfo.onFullLocus(response.body.locus);
      }
    })
    .catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:util#disconnectPhoneAudio --> An error occured while disconnecting phone audio in meeting ${meeting.id}, error: ${err}`
      );

      return Promise.reject(err);
    });
};

// by default will leave on meeting's resourceId
// if you explicity want it not to leave on resource id, pass
// {resourceId: null}
// TODO: chris, you can modify this however you want
MeetingUtil.leaveMeeting = (meeting, options: any = {}) => {
  if (meeting.meetingState === FULL_STATE.INACTIVE) {
    // TODO: clean up if the meeting is already inactive
    return Promise.reject(new MeetingNotActiveError());
  }

  if (MeetingUtil.isUserInLeftState(meeting.locusInfo)) {
    return Promise.reject(new UserNotJoinedError());
  }

  const defaultOptions = {
    locusUrl: meeting.locusUrl,
    selfId: meeting.selfId,
    correlationId: meeting.correlationId,
    resourceId: meeting.resourceId,
    deviceUrl: meeting.deviceUrl,
  };

  const leaveOptions = {...defaultOptions, ...options};

  return meeting.meetingRequest
    .leaveMeeting(leaveOptions)
    .then((response) => {
      if (response && response.body && response.body.locus) {
        // && !options.moveMeeting) {
        meeting.locusInfo.onFullLocus(response.body.locus);
      }

      return Promise.resolve();
    })
    .then(() => {
      if (options.moveMeeting) {
        return Promise.resolve();
      }

      return MeetingUtil.cleanUp(meeting);
    })
    .catch((err) => {
      // TODO: If the meeting state comes as LEFT or INACTIVE as response then
      // 1)  on leave clean up the meeting or simply do a sync on the meeting
      // 2) If the error says meeting is inactive then destroy the meeting object
      LoggerProxy.logger.error(
        `Meeting:util#leaveMeeting --> An error occured while trying to leave meeting with an id of ${meeting.id}, error: ${err}`
      );

      return Promise.reject(err);
    });
};
MeetingUtil.declineMeeting = (meeting, reason) =>
  meeting.meetingRequest.declineMeeting({
    locusUrl: meeting.locusUrl,
    deviceUrl: meeting.deviceUrl,
    reason,
  });

MeetingUtil.isUserInLeftState = (locusInfo) => locusInfo.parsedLocus?.self?.state === _LEFT_;

MeetingUtil.isUserInIdleState = (locusInfo) => locusInfo.parsedLocus?.self?.state === _IDLE_;

MeetingUtil.isUserInJoinedState = (locusInfo) => locusInfo.parsedLocus?.self?.state === _JOINED_;

MeetingUtil.isMediaEstablished = (currentMediaStatus) =>
  currentMediaStatus &&
  (currentMediaStatus.audio || currentMediaStatus.video || currentMediaStatus.share);

MeetingUtil.joinMeetingOptions = (meeting, options: any = {}) => {
  meeting.resourceId = meeting.resourceId || options.resourceId;

  if (meeting.requiredCaptcha) {
    return Promise.reject(new CaptchaError());
  }
  if (meeting.passwordStatus === PASSWORD_STATUS.REQUIRED) {
    return Promise.reject(new PasswordError());
  }

  if (options.pin) {
    Metrics.postEvent({
      event: eventType.PIN_COLLECTED,
      meeting,
    });
  }

  // normal join meeting, scenario A, D
  return MeetingUtil.joinMeeting(meeting, options)
    .then((response) => {
      meeting.setLocus(response);

      return Promise.resolve(response);
    })
    .catch((err) => {
      // joining a claimed PMR that is not my own, scenario B
      if (MeetingUtil.isPinOrGuest(err)) {
        Metrics.postEvent({
          event: eventType.PIN_PROMPT,
          meeting,
        });

        // request host pin or non host for unclaimed PMR, start of Scenario C
        // see https://sqbu-github.cisco.com/WebExSquared/locus/wiki/Locus-Lobby-and--IVR-Feature
        return Promise.reject(new IntentToJoinError('Error Joining Meeting', err));
      }
      LoggerProxy.logger.error('Meeting:util#joinMeetingOptions --> Error joining the call, ', err);

      return Promise.reject(new JoinMeetingError(options, 'Error Joining Meeting', err));
    });
};

MeetingUtil.updateTransceiver = (options, meetingOptions) => {
  const {
    type,
    sendTrack,
    receiveTrack,
    track,
    transceiver,
    peerConnection,
    previousMediaDirection,
  } = options;

  if (
    (sendTrack !== undefined && sendTrack !== previousMediaDirection.sendTrack) ||
    (receiveTrack !== undefined && receiveTrack !== previousMediaDirection.receiveTrack)
  ) {
    return Media.updateTransceiver(
      {
        meetingId: meetingOptions.meeting.id,
        remoteQualityLevel: meetingOptions.mediaProperties.remoteQualityLevel,
        enableRtx: meetingOptions.meeting.config.enableRtx,
        enableExtmap: meetingOptions.meeting.config.enableExtmap,
      },
      peerConnection,
      transceiver,
      {
        track,
        type,
        receiveTrack,
        sendTrack,
      }
    )
      .then(() =>
        meetingOptions.meeting.roap.sendRoapMediaRequest({
          sdp: meetingOptions.mediaProperties.peerConnection.sdp,
          roapSeq: meetingOptions.meeting.roapSeq,
          meeting: meetingOptions.meeting, // or can pass meeting ID
        })
      )
      .catch((e) => {
        LoggerProxy.logger.error(
          `Meeting:util#updateTransceiver --> Error updating the ${type} streams with error: ${e}`
        );
      });
  }
  if (track) {
    transceiver.sender.replaceTrack(track);

    return Promise.resolve();
  }

  return Promise.reject(new ParameterError('update Failed: please pass valid parameter'));
};

MeetingUtil.validateOptions = (options) => {
  const {sendVideo, sendAudio, sendShare, localStream, localShare} = options;

  if (sendVideo && !MeetingUtil.getTrack(localStream).videoTrack) {
    return Promise.reject(new ParameterError('please pass valid video streams'));
  }

  if (sendAudio && !MeetingUtil.getTrack(localStream).audioTrack) {
    return Promise.reject(new ParameterError('please pass valid audio streams'));
  }

  if (sendShare && !MeetingUtil.getTrack(localShare).videoTrack) {
    return Promise.reject(new ParameterError('please pass valid share streams'));
  }

  return Promise.resolve();
};

MeetingUtil.getTrack = (stream) => {
  let audioTrack = null;
  let videoTrack = null;
  let audioTracks = null;
  let videoTracks = null;

  if (!stream) {
    return {audioTrack: null, videoTrack: null};
  }
  if (stream.getAudioTracks) {
    audioTracks = stream.getAudioTracks();
  }
  if (stream.getVideoTracks) {
    videoTracks = stream.getVideoTracks();
  }

  if (audioTracks && audioTracks.length > 0) {
    [audioTrack] = audioTracks;
  }

  if (videoTracks && videoTracks.length > 0) {
    [videoTrack] = videoTracks;
  }

  return {audioTrack, videoTrack};
};

MeetingUtil.getModeratorFromLocusInfo = (locusInfo) =>
  locusInfo &&
  locusInfo.parsedLocus &&
  locusInfo.parsedLocus.info &&
  locusInfo.parsedLocus.info &&
  locusInfo.parsedLocus.info.moderator;

MeetingUtil.getPolicyFromLocusInfo = (locusInfo) =>
  locusInfo &&
  locusInfo.parsedLocus &&
  locusInfo.parsedLocus.info &&
  locusInfo.parsedLocus.info &&
  locusInfo.parsedLocus.info.policy;

MeetingUtil.getUserDisplayHintsFromLocusInfo = (locusInfo) =>
  locusInfo?.parsedLocus?.info?.userDisplayHints || [];

MeetingUtil.canInviteNewParticipants = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.ADD_GUEST);

MeetingUtil.canAdmitParticipant = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.ROSTER_WAITING_TO_JOIN);

MeetingUtil.canUserLock = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.LOCK_CONTROL_LOCK) &&
  displayHints.includes(DISPLAY_HINTS.LOCK_STATUS_UNLOCKED);

MeetingUtil.canUserUnlock = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.LOCK_CONTROL_UNLOCK) &&
  displayHints.includes(DISPLAY_HINTS.LOCK_STATUS_LOCKED);

MeetingUtil.canUserRaiseHand = (displayHints) => displayHints.includes(DISPLAY_HINTS.RAISE_HAND);

MeetingUtil.canUserLowerAllHands = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.LOWER_ALL_HANDS);

MeetingUtil.canUserLowerSomeoneElsesHand = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND);

MeetingUtil.bothLeaveAndEndMeetingAvailable = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.LEAVE_TRANSFER_HOST_END_MEETING) ||
  displayHints.includes(DISPLAY_HINTS.LEAVE_END_MEETING);

MeetingUtil.lockMeeting = (actions, request, locusUrl) => {
  if (actions && actions.canLock) {
    return request.lockMeeting({locusUrl, lock: true});
  }

  return Promise.reject(new PermissionError('Lock not allowed, due to joined property.'));
};

MeetingUtil.unlockMeeting = (actions, request, locusUrl) => {
  if (actions && actions.canUnlock) {
    return request.lockMeeting({locusUrl, lock: false});
  }

  return Promise.reject(new PermissionError('Unlock not allowed, due to joined property.'));
};

MeetingUtil.handleAudioLogging = (audioTrack) => {
  const LOG_HEADER = 'MeetingUtil#handleAudioLogging -->';

  if (audioTrack) {
    const settings = audioTrack.getSettings();
    const {deviceId} = settings;

    LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${deviceId}`);
    LoggerProxy.logger.log(LOG_HEADER, 'settings =', JSON.stringify(settings));
  }
};

MeetingUtil.handleVideoLogging = (videoTrack) => {
  const LOG_HEADER = 'MeetingUtil#handleVideoLogging -->';

  if (videoTrack) {
    const settings = videoTrack.getSettings();
    const {deviceId} = settings;

    LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${deviceId}`);
    LoggerProxy.logger.log(LOG_HEADER, 'settings =', JSON.stringify(settings));
  }
};

MeetingUtil.handleDeviceLogging = (devices = []) => {
  const LOG_HEADER = 'MeetingUtil#handleDeviceLogging -->';

  devices.forEach((device) => {
    LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${device.deviceId}`);
    LoggerProxy.logger.log(LOG_HEADER, 'settings', JSON.stringify(device));
  });
};

MeetingUtil.endMeetingForAll = (meeting) => {
  if (meeting.meetingState === FULL_STATE.INACTIVE) {
    return Promise.reject(new MeetingNotActiveError());
  }

  const endOptions = {
    locusUrl: meeting.locusUrl,
  };

  return meeting.meetingRequest
    .endMeetingForAll(endOptions)
    .then((response) => {
      if (response && response.body && response.body.locus) {
        meeting.locusInfo.onFullLocus(response.body.locus);
      }

      return Promise.resolve();
    })
    .then(() => MeetingUtil.cleanUp(meeting))
    .catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:util#endMeetingForAll An error occured while trying to end meeting for all with an id of ${meeting.id}, error: ${err}`
      );

      return Promise.reject(err);
    });
};

MeetingUtil.canEnableClosedCaption = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.CAPTION_START);

MeetingUtil.canStartTranscribing = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.TRANSCRIPTION_CONTROL_START);

MeetingUtil.canStopTranscribing = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.TRANSCRIPTION_CONTROL_STOP);

MeetingUtil.isClosedCaptionActive = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.CAPTION_STATUS_ACTIVE);

MeetingUtil.isWebexAssistantActive = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.WEBEX_ASSISTANT_STATUS_ACTIVE);

MeetingUtil.canViewCaptionPanel = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.ENABLE_CAPTION_PANEL);

MeetingUtil.isRealTimeTranslationEnabled = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.DISPLAY_REAL_TIME_TRANSLATION);

MeetingUtil.canSelectSpokenLanguages = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.DISPLAY_NON_ENGLISH_ASR);

MeetingUtil.waitingForOthersToJoin = (displayHints) =>
  displayHints.includes(DISPLAY_HINTS.WAITING_FOR_OTHERS);

export default MeetingUtil;
