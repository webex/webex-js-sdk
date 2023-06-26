import {LocalCameraTrack, LocalMicrophoneTrack} from '@webex/media-helpers';

import {cloneDeep} from 'lodash';
import {MeetingNotActiveError, UserNotJoinedError} from '../common/errors/webex-errors';
import Metrics from '../metrics';
import {eventType, trigger} from '../metrics/config';
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

const MeetingUtil = {
  parseLocusJoin: (response) => {
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
  },

  remoteUpdateAudioVideo: (meeting, audioMuted?: boolean, videoMuted?: boolean) => {
    if (!meeting) {
      return Promise.reject(new ParameterError('You need a meeting object.'));
    }

    if (!meeting.locusMediaRequest) {
      return Promise.reject(
        new ParameterError(
          'You need a meeting with a media connection, call Meeting.addMedia() first.'
        )
      );
    }

    Metrics.postEvent({event: eventType.MEDIA_REQUEST, meeting});

    return meeting.locusMediaRequest
      .send({
        type: 'LocalMute',
        selfUrl: meeting.selfUrl,
        mediaId: meeting.mediaId,
        sequence: meeting.locusInfo.sequence,
        muteOptions: {
          audioMuted,
          videoMuted,
        },
      })
      .then((response) => {
        Metrics.postEvent({event: eventType.MEDIA_RESPONSE, meeting});

        return response?.body?.locus;
      });
  },

  hasOwner: (info) => info && info.owner,

  isOwnerSelf: (owner, selfId) => owner === selfId,

  isPinOrGuest: (err) => err?.body?.errorCode && INTENT_TO_JOIN.includes(err.body.errorCode),

  joinMeeting: (meeting, options) => {
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
        preferTranscoding: !meeting.isMultistream,
        asResourceOccupant: options.asResourceOccupant,
        breakoutsSupported: options.breakoutsSupported,
        locale: options.locale,
        deviceCapabilities: options.deviceCapabilities,
        liveAnnotationSupported: options.liveAnnotationSupported,
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
  },

  cleanUp: (meeting) => {
    meeting.breakouts.cleanUp();

    // make sure we send last metrics before we close the peerconnection
    const stopStatsAnalyzer = meeting.statsAnalyzer
      ? meeting.statsAnalyzer.stopAnalyzer()
      : Promise.resolve();

    return stopStatsAnalyzer
      .then(() => meeting.closeRemoteTracks())
      .then(() => meeting.closePeerConnections())
      .then(() => {
        meeting.cleanupLocalTracks();
        meeting.unsetRemoteTracks();
        meeting.unsetPeerConnections();
        meeting.reconnectionManager.cleanUp();
      })
      .then(() => meeting.stopKeepAlive())
      .then(() => meeting.updateLLMConnection());
  },

  disconnectPhoneAudio: (meeting, phoneUrl) => {
    if (meeting.meetingState === FULL_STATE.INACTIVE) {
      return Promise.reject(new MeetingNotActiveError());
    }

    const options = {
      locusUrl: meeting.locusUrl,
      selfId: meeting.selfId,
      correlationId: meeting.correlationId,
      phoneUrl,
    };

    return meeting.meetingRequest.disconnectPhoneAudio(options).catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:util#disconnectPhoneAudio --> An error occured while disconnecting phone audio in meeting ${meeting.id}, error: ${err}`
      );

      return Promise.reject(err);
    });
  },

  // by default will leave on meeting's resourceId
  // if you explicity want it not to leave on resource id, pass
  // {resourceId: null}
  // TODO: chris, you can modify this however you want
  leaveMeeting: (meeting, options: any = {}) => {
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
  },
  declineMeeting: (meeting, reason) =>
    meeting.meetingRequest.declineMeeting({
      locusUrl: meeting.locusUrl,
      deviceUrl: meeting.deviceUrl,
      reason,
    }),

  isUserInLeftState: (locusInfo) => locusInfo.parsedLocus?.self?.state === _LEFT_,

  isUserInIdleState: (locusInfo) => locusInfo.parsedLocus?.self?.state === _IDLE_,

  isUserInJoinedState: (locusInfo) => locusInfo.parsedLocus?.self?.state === _JOINED_,

  isMediaEstablished: (currentMediaStatus) =>
    currentMediaStatus &&
    (currentMediaStatus.audio || currentMediaStatus.video || currentMediaStatus.share),

  joinMeetingOptions: (meeting, options: any = {}) => {
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
        LoggerProxy.logger.error(
          'Meeting:util#joinMeetingOptions --> Error joining the call, ',
          err
        );

        return Promise.reject(new JoinMeetingError(options, 'Error Joining Meeting', err));
      });
  },

  getTrack: (stream) => {
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
  },

  getModeratorFromLocusInfo: (locusInfo) =>
    locusInfo &&
    locusInfo.parsedLocus &&
    locusInfo.parsedLocus.info &&
    locusInfo.parsedLocus.info &&
    locusInfo.parsedLocus.info.moderator,

  getPolicyFromLocusInfo: (locusInfo) =>
    locusInfo &&
    locusInfo.parsedLocus &&
    locusInfo.parsedLocus.info &&
    locusInfo.parsedLocus.info &&
    locusInfo.parsedLocus.info.policy,

  getUserDisplayHintsFromLocusInfo: (locusInfo) =>
    locusInfo?.parsedLocus?.info?.userDisplayHints || [],

  canInviteNewParticipants: (displayHints) => displayHints.includes(DISPLAY_HINTS.ADD_GUEST),

  canAdmitParticipant: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.ROSTER_WAITING_TO_JOIN),

  canUserLock: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.LOCK_CONTROL_LOCK) &&
    displayHints.includes(DISPLAY_HINTS.LOCK_STATUS_UNLOCKED),

  canUserUnlock: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.LOCK_CONTROL_UNLOCK) &&
    displayHints.includes(DISPLAY_HINTS.LOCK_STATUS_LOCKED),

  canUserRaiseHand: (displayHints) => displayHints.includes(DISPLAY_HINTS.RAISE_HAND),

  canUserLowerAllHands: (displayHints) => displayHints.includes(DISPLAY_HINTS.LOWER_ALL_HANDS),

  canUserLowerSomeoneElsesHand: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND),

  bothLeaveAndEndMeetingAvailable: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.LEAVE_TRANSFER_HOST_END_MEETING) ||
    displayHints.includes(DISPLAY_HINTS.LEAVE_END_MEETING),

  canManageBreakout: (displayHints) => displayHints.includes(DISPLAY_HINTS.BREAKOUT_MANAGEMENT),
  canBroadcastMessageToBreakout: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.BROADCAST_MESSAGE_TO_BREAKOUT),

  isSuppressBreakoutSupport: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.UCF_SUPPRESS_BREAKOUTS_SUPPORT),

  canAdmitLobbyToBreakout: (displayHints) =>
    !displayHints.includes(DISPLAY_HINTS.DISABLE_LOBBY_TO_BREAKOUT),

  isBreakoutPreassignmentsEnabled: (displayHints) =>
    !displayHints.includes(DISPLAY_HINTS.DISABLE_BREAKOUT_PREASSIGNMENTS),

  canUserAskForHelp: (displayHints) => !displayHints.includes(DISPLAY_HINTS.DISABLE_ASK_FOR_HELP),

  lockMeeting: (actions, request, locusUrl) => {
    if (actions && actions.canLock) {
      return request.lockMeeting({locusUrl, lock: true});
    }

    return Promise.reject(new PermissionError('Lock not allowed, due to joined property.'));
  },

  unlockMeeting: (actions, request, locusUrl) => {
    if (actions && actions.canUnlock) {
      return request.lockMeeting({locusUrl, lock: false});
    }

    return Promise.reject(new PermissionError('Unlock not allowed, due to joined property.'));
  },

  handleAudioLogging: (audioTrack?: LocalMicrophoneTrack) => {
    const LOG_HEADER = 'MeetingUtil#handleAudioLogging -->';

    if (audioTrack) {
      const settings = audioTrack.underlyingTrack.getSettings();
      const {deviceId} = settings;

      LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${deviceId}`);
      LoggerProxy.logger.log(LOG_HEADER, 'settings =', JSON.stringify(settings));
    }
  },

  handleVideoLogging: (videoTrack?: LocalCameraTrack) => {
    const LOG_HEADER = 'MeetingUtil#handleVideoLogging -->';

    if (videoTrack) {
      const settings = videoTrack.underlyingTrack.getSettings();
      const {deviceId} = settings;

      LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${deviceId}`);
      LoggerProxy.logger.log(LOG_HEADER, 'settings =', JSON.stringify(settings));
    }
  },

  handleDeviceLogging: (devices = []) => {
    const LOG_HEADER = 'MeetingUtil#handleDeviceLogging -->';

    devices.forEach((device) => {
      LoggerProxy.logger.log(LOG_HEADER, `deviceId = ${device.deviceId}`);
      LoggerProxy.logger.log(LOG_HEADER, 'settings', JSON.stringify(device));
    });
  },

  endMeetingForAll: (meeting) => {
    if (meeting.meetingState === FULL_STATE.INACTIVE) {
      return Promise.reject(new MeetingNotActiveError());
    }

    const endOptions = {
      locusUrl: meeting.locusUrl,
    };

    return meeting.meetingRequest
      .endMeetingForAll(endOptions)
      .then(() => MeetingUtil.cleanUp(meeting))
      .catch((err) => {
        LoggerProxy.logger.error(
          `Meeting:util#endMeetingForAll An error occured while trying to end meeting for all with an id of ${meeting.id}, error: ${err}`
        );

        return Promise.reject(err);
      });
  },

  canEnableClosedCaption: (displayHints) => displayHints.includes(DISPLAY_HINTS.CAPTION_START),

  isSaveTranscriptsEnabled: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.SAVE_TRANSCRIPTS_ENABLED),

  canStartTranscribing: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.TRANSCRIPTION_CONTROL_START),

  canStopTranscribing: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.TRANSCRIPTION_CONTROL_STOP),

  isClosedCaptionActive: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.CAPTION_STATUS_ACTIVE),

  isWebexAssistantActive: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.WEBEX_ASSISTANT_STATUS_ACTIVE),

  canViewCaptionPanel: (displayHints) => displayHints.includes(DISPLAY_HINTS.ENABLE_CAPTION_PANEL),

  isRealTimeTranslationEnabled: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.DISPLAY_REAL_TIME_TRANSLATION),

  canSelectSpokenLanguages: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.DISPLAY_NON_ENGLISH_ASR),

  waitingForOthersToJoin: (displayHints) => displayHints.includes(DISPLAY_HINTS.WAITING_FOR_OTHERS),

  canSendReactions: (originalValue, displayHints) => {
    if (displayHints.includes(DISPLAY_HINTS.REACTIONS_ACTIVE)) {
      return true;
    }
    if (displayHints.includes(DISPLAY_HINTS.REACTIONS_INACTIVE)) {
      return false;
    }

    return originalValue;
  },
  canUserRenameSelfAndObserved: (displayHints) =>
    displayHints.includes(DISPLAY_HINTS.CAN_RENAME_SELF_AND_OBSERVED),

  canUserRenameOthers: (displayHints) => displayHints.includes(DISPLAY_HINTS.CAN_RENAME_OTHERS),

  /**
   * Adds the current locus sequence information to a request body
   * @param {Object} meeting The meeting object
   * @param {Object} requestBody The body of a request to locus
   * @returns {void}
   */
  addSequence: (meeting, requestBody) => {
    const sequence = meeting?.locusInfo?.sequence;

    if (!sequence) {
      return;
    }

    requestBody.sequence = sequence;
  },

  /**
   * Updates the locus info for the meeting with the delta locus
   * returned from requests that include the sequence information
   * Returns the original response object
   * @param {Object} meeting The meeting object
   * @param {Object} response The response of the http request
   * @returns {Object}
   */
  updateLocusWithDelta: (meeting, response) => {
    if (!meeting) {
      return response;
    }

    const locus = response?.body?.locus;

    if (locus) {
      meeting.locusInfo.onDeltaLocus(locus);
    }

    return response;
  },

  generateLocusDeltaRequest: (originalMeeting) => {
    const meetingRef = new WeakRef(originalMeeting);

    const locusDeltaRequest = (originalOptions) => {
      const meeting = meetingRef.deref();

      if (!meeting) {
        return Promise.resolve();
      }

      const options = cloneDeep(originalOptions);

      if (!options.body) {
        options.body = {};
      }

      MeetingUtil.addSequence(meeting, options.body);

      return meeting
        .request(options)
        .then((response) => MeetingUtil.updateLocusWithDelta(meeting, response));
    };

    return locusDeltaRequest;
  },
};

export default MeetingUtil;
