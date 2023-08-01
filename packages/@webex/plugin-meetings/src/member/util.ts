import {
  _USER_,
  _RESOURCE_ROOM_,
  _OBSERVE_,
  _WAIT_,
  _LEFT_,
  _JOINED_,
  _IDLE_,
  _IN_LOBBY_,
  _NOT_IN_MEETING_,
  _IN_MEETING_,
  AUDIO_STATUS,
  VIDEO_STATUS,
  _SEND_RECEIVE_,
  _RECEIVE_ONLY_,
  _CALL_,
} from '../constants';
import ParameterError from '../common/errors/parameter';
import {IMediaStatus} from './member.types';

const MemberUtil: any = {};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isUser = (participant: any) => participant && participant.type === _USER_;

MemberUtil.isModerator = (participant) => participant && participant.moderator;

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

MemberUtil.isModeratorAssignmentProhibited = (participant) =>
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
    (user) => user.id === id || (user.person && user.person.id === id)
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
  const mutedStatus = MemberUtil.isMuted(participant.status, AUDIO_STATUS);

  if (participant.controls && participant.controls.audio) {
    if (participant.controls.audio.muted) {
      return true;
    }
    if (mutedStatus) {
      return true;
    }
  }

  return false;
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isVideoMuted = (participant: any) => {
  if (!participant) {
    throw new ParameterError('Video could not be processed, participant is undefined.');
  }

  return MemberUtil.isMuted(participant.status, VIDEO_STATUS);
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
 * utility method for audio/video muted status
 * @param {String} status
 * @param {String} accessor
 * @returns {Boolean}
 */
MemberUtil.isMuted = (status: string, accessor: string) => {
  if (status) {
    if (status[accessor] === _RECEIVE_ONLY_) {
      return true;
    }
    if (status[accessor] === _SEND_RECEIVE_) {
      return false;
    }
  }

  return null;
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

MemberUtil.isRemovable = (isSelf, isGuest, isInMeeting, type) => {
  if (isGuest || isSelf) {
    return false;
  }
  if (type === _CALL_) {
    return false;
  }
  if (isInMeeting) {
    return true;
  }

  return false;
};

MemberUtil.isMutable = (isSelf, isDevice, isInMeeting, isMuted, type) => {
  if (!isInMeeting) {
    return false;
  }
  if (isMuted) {
    return false;
  }
  if (type === _CALL_) {
    return false;
  }
  if (isSelf || isDevice) {
    return true;
  }

  return false;
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
        (device) =>
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
    audio: participant.status.audioStatus,
    video: participant.status.videoStatus,
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
