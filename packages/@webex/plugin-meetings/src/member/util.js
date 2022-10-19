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
  _CALL_
} from '../constants';
import ParameterError from '../common/errors/parameter';

const MemberUtil = {};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isUser = (participant) => participant && participant.type === _USER_;

MemberUtil.isModerator = (participant) => participant && participant.moderator;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isGuest = (participant) => participant && participant.guest;

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isDevice = (participant) => participant && participant.type === _RESOURCE_ROOM_;

MemberUtil.isModeratorAssignmentProhibited = (participant) => participant && participant.moderatorAssignmentNotAllowed;

/**
 * checks to see if the participant id is the same as the passed id
 * there are multiple ids that can be used
 * @param {Object} participant the locus participant
 * @param {String} id
 * @returns {Boolean}
 */
MemberUtil.isSame = (participant, id) => participant &&
  (participant.id === id || participant.person && participant.person.id === id);

/**
 * checks to see if the participant id is the same as the passed id for associated devices
 * there are multiple ids that can be used
 * @param {Object} participant the locus participant
 * @param {String} id
 * @returns {Boolean}
 */
MemberUtil.isAssociatedSame = (participant, id) => participant &&
participant.associatedUsers &&
participant.associatedUsers.some((user) => (user.id === id || user.person && user.person.id === id));

/**
 * @param {Object} participant the locus participant
 * @param {Boolean} isGuest
 * @param {String} status
 * @returns {Boolean}
 */
MemberUtil.isNotAdmitted = (participant, isGuest, status) => participant &&
  participant.guest && ((participant.devices && participant.devices[0] &&
  participant.devices[0].intent && participant.devices[0].intent.type === _WAIT_ &&
  isGuest && status === _IN_LOBBY_) || !status === _IN_MEETING_);

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isAudioMuted = (participant) => {
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
MemberUtil.isVideoMuted = (participant) => {
  if (!participant) {
    throw new ParameterError('Video could not be processed, participant is undefined.');
  }

  return MemberUtil.isMuted(participant.status, VIDEO_STATUS);
};

/**
 * @param {Object} participant the locus participant
 * @returns {Boolean}
 */
MemberUtil.isHandRaised = (participant) => {
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
MemberUtil.isMuted = (status, accessor) => {
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
MemberUtil.getRecordingMember = (controls) => {
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
MemberUtil.isRecording = (participant) => {
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
MemberUtil.extractStatus = (participant) => {
  if (!(participant && participant.devices && participant.devices.length)) {
    return _NOT_IN_MEETING_;
  }
  if (participant.state === _JOINED_) {
    return _IN_MEETING_;
  }
  if (participant.state === _IDLE_) {
    if (participant.devices && participant.devices.length > 0) {
      const foundDevice = participant.devices.find((device) => device.intent && (device.intent.type === _WAIT_ || device.intent.type === _OBSERVE_));

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
MemberUtil.extractId = (participant) => {
  if (participant) {
    return participant.id;
  }

  return null;
};

/**
 * @param {Object} participant the locus participant
 * @returns {String}
 */
MemberUtil.extractName = (participant) => {
  if (participant && participant.person) {
    return participant.person.name;
  }

  return null;
};

export default MemberUtil;
