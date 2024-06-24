import {
  IExternalRoles,
  IMediaStatus,
  ParticipantWithRoles,
  ServerRoles,
  ServerRoleShape,
} from './types';
import {
  _CALL_,
  _IDLE_,
  _IN_LOBBY_,
  _IN_MEETING_,
  _JOINED_,
  _LEFT_,
  _NOT_IN_MEETING_,
  _OBSERVE_,
  _RECEIVE_ONLY_,
  _RESOURCE_ROOM_,
  _SEND_RECEIVE_,
  _USER_,
  _WAIT_,
  AUDIO,
  AUDIO_STATUS,
  VIDEO,
  VIDEO_STATUS,
} from '../constants';
import ParameterError from '../common/errors/parameter';

const MemberUtil: any = {};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.canReclaimHost = (participant: Record<string, any>) => {
  if (!participant) {
    throw new ParameterError(
      'canReclaimHostRole could not be processed, participant is undefined.'
    );
  }

  return participant.canReclaimHostRole || false;
};

/**
 * @param {Object} participant the locus participant
 * @returns {[ServerRoleShape]}
 */
MemberUtil.getControlsRoles = (participant: ParticipantWithRoles): Array<ServerRoleShape> =>
  participant?.controls?.role?.roles;

/**
 * @param {Object} participant the locus participant
 * @param {ServerRoles} controlRole the search role
 * @returns {Boolean}
 */
MemberUtil.hasRole = (participant: Record<string, any>, controlRole: ServerRoles): boolean =>
  MemberUtil.getControlsRoles(participant)?.some(
    (role: Record<string, any>) => role.type === controlRole && role.hasRole
  );

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.hasCohost = (participant: ParticipantWithRoles): boolean =>
  MemberUtil.hasRole(participant, ServerRoles.Cohost) || false;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.hasModerator = (participant: ParticipantWithRoles): boolean =>
  MemberUtil.hasRole(participant, ServerRoles.Moderator) || false;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.hasPresenter = (participant: ParticipantWithRoles): boolean =>
  MemberUtil.hasRole(participant, ServerRoles.Presenter) || false;

/**
 * @param {Object} participant the locus participant
 * @returns {IExternalRoles}
 */
MemberUtil.extractControlRoles = (participant: ParticipantWithRoles): IExternalRoles => {
  return {
    cohost: MemberUtil.hasCohost(participant),
    moderator: MemberUtil.hasModerator(participant),
    presenter: MemberUtil.hasPresenter(participant),
  };
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isUser = (participant: any) => participant && participant.type === _USER_;

MemberUtil.isModerator = (participant: Record<string, any>) => participant && participant.moderator;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isGuest = (participant: any) => participant && participant.guest;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isDevice = (participant: any) => participant && participant.type === _RESOURCE_ROOM_;

MemberUtil.isModeratorAssignmentProhibited = (participant: Record<string, any>) =>
  participant && participant.moderatorAssignmentNotAllowed;

/**
 * checks to see if the participant id is the same as the passed id
 * there are multiple ids that can be used
 * @param {Object} participant the locus participant
 * @param {String} id
 * @returns {Boolean}
 */
MemberUtil.isSame = (participant: any, id: string) =>
  participant && (participant.id === id || (participant.person && participant.person.id === id));

/**
 * checks to see if the participant id is the same as the passed id for associated devices
 * there are multiple ids that can be used
 * @param {Object} participant the locus participant
 * @param {String} id
 * @returns {Boolean}
 */
MemberUtil.isAssociatedSame = (participant: any, id: string) =>
  participant &&
  participant.associatedUsers &&
  participant.associatedUsers.some(
    (user: Record<string, any>) => user.id === id || (user.person && user.person.id === id)
  );

/**
 * @param {Object} participant the locus participant
 * @param {Boolean} isGuest
 * @param {String} status
 * @returns {Boolean}
 */
MemberUtil.isNotAdmitted = (participant: any, isGuest: boolean, status: string): boolean =>
  participant &&
  participant.guest &&
  ((participant.devices &&
    participant.devices[0] &&
    participant.devices[0].intent &&
    participant.devices[0].intent.type === _WAIT_ &&
    // @ts-ignore
    isGuest &&
    status === _IN_LOBBY_) ||
    // @ts-ignore
    !status === _IN_MEETING_);

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isAudioMuted = (participant: any) => {
  if (!participant) {
    throw new ParameterError('Audio could not be processed, participant is undefined.');
  }

  return MemberUtil.isMuted(participant, AUDIO_STATUS, AUDIO);
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isVideoMuted = (participant: any): boolean => {
  if (!participant) {
    throw new ParameterError('Video could not be processed, participant is undefined.');
  }

  return MemberUtil.isMuted(participant, VIDEO_STATUS, VIDEO);
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isHandRaised = (participant: any) => {
  if (!participant) {
    throw new ParameterError('Raise hand could not be processed, participant is undefined.');
  }

  return participant.controls?.hand?.raised || false;
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isBreakoutsSupported = (participant: Record<string, any>) => {
  if (!participant) {
    throw new ParameterError('Breakout support could not be processed, participant is undefined.');
  }

  return !participant.doesNotSupportBreakouts;
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isInterpretationSupported = (participant: Record<string, any>) => {
  if (!participant) {
    throw new ParameterError(
      'Interpretation support could not be processed, participant is undefined.'
    );
  }

  return !participant.doesNotSupportSiInterpreter;
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isLiveAnnotationSupported = (participant: Record<string, any>) => {
  if (!participant) {
    throw new ParameterError(
      'LiveAnnotation support could not be processed, participant is undefined.'
    );
  }

  return !participant.annotatorAssignmentNotAllowed;
};

/**
 * utility method for audio/video muted status
 * @param {any} participant
 * @param {String} statusAccessor
 * @param {String} controlsAccessor
 * @returns {Boolean | undefined}
 */
MemberUtil.isMuted = (participant: any, statusAccessor: string, controlsAccessor: string) => {
  // check remote mute
  const remoteMute = participant?.controls?.[controlsAccessor]?.muted;
  if (remoteMute === true) {
    return true;
  }

  // check local mute
  const localStatus = participant?.status?.[statusAccessor];
  if (localStatus === _RECEIVE_ONLY_) {
    return true;
  }
  if (localStatus === _SEND_RECEIVE_) {
    return false;
  }

  return remoteMute;
};

/**
 * utility method for getting the recording member for later comparison
 * @param {Object} controls
 * @returns {String|null}
 */
MemberUtil.getRecordingMember = (controls: any) => {
  if (!controls) {
    return null;
  }
  if (controls.record && controls.record.recording && controls.record.meta) {
    return controls.record.meta.modifiedBy;
  }

  return null;
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isRecording = (participant: any) => {
  if (!participant) {
    throw new ParameterError('Recording could not be processed, participant is undefined.');
  }
  if (participant.controls && participant.controls.localRecord) {
    return participant.controls.localRecord.recording;
  }

  return false;
};

MemberUtil.isRemovable = (
  isSelf: boolean,
  isGuest: boolean,
  isInMeeting: boolean,
  type: string
) => {
  if (isGuest || isSelf) {
    return false;
  }
  if (type === _CALL_) {
    return false;
  }

  return isInMeeting;
};

MemberUtil.isMutable = (
  isSelf: boolean,
  isDevice: boolean,
  isInMeeting: boolean,
  isMuted: boolean,
  type: string
) => {
  if (!isInMeeting) {
    return false;
  }
  if (isMuted) {
    return false;
  }
  if (type === _CALL_) {
    return false;
  }

  return isSelf || isDevice;
};

/**
 * @param {Object} participant the locus participant
 * @returns {String}
 */
MemberUtil.extractStatus = (participant: any) => {
  if (!(participant && participant.devices && participant.devices.length)) {
    return _NOT_IN_MEETING_;
  }
  if (participant.state === _JOINED_) {
    return _IN_MEETING_;
  }
  if (participant.state === _IDLE_) {
    if (participant.devices && participant.devices.length > 0) {
      const foundDevice = participant.devices.find(
        (device: Record<string, any>) =>
          device.intent && (device.intent.type === _WAIT_ || device.intent.type === _OBSERVE_)
      );

      return foundDevice ? _IN_LOBBY_ : _NOT_IN_MEETING_;
    }

    return _NOT_IN_MEETING_;
  }
  if (participant.state === _LEFT_) {
    return _NOT_IN_MEETING_;
  }

  return _NOT_IN_MEETING_;
};

/**
 * @param {Object} participant the locus participant
 * @returns {String}
 */
MemberUtil.extractId = (participant: any) => {
  if (participant) {
    return participant.id;
  }

  return null;
};

/**
 * extracts the media status from nested participant object
 * @param {Object} participant the locus participant
 * @returns {Object}
 */
MemberUtil.extractMediaStatus = (participant: any): IMediaStatus => {
  if (!participant) {
    throw new ParameterError('Media status could not be extracted, participant is undefined.');
  }

  return {
    audio: participant.status?.audioStatus,
    video: participant.status?.videoStatus,
  };
};

/**
 * @param {Object} participant the locus participant
 * @returns {String}
 */
MemberUtil.extractName = (participant: any) => {
  if (participant && participant.person) {
    return participant.person.name;
  }

  return null;
};

export default MemberUtil;
