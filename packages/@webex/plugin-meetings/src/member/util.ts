import {
  IExternalRoles,
  ParticipantWithRoles,
  ServerRoles,
  ServerRoleShape,
  IMediaStatus,
  ParticipantWithBrb,
} from './types';
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
  VIDEO,
  AUDIO,
} from '../constants';
import ParameterError from '../common/errors/parameter';

const MemberUtil = {
  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  canReclaimHost: (participant) => {
    if (!participant) {
      throw new ParameterError(
        'canReclaimHostRole could not be processed, participant is undefined.'
      );
    }

    return participant.canReclaimHostRole || false;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {[ServerRoleShape]}
   */
  getControlsRoles: (participant: ParticipantWithRoles): Array<ServerRoleShape> =>
    participant?.controls?.role?.roles,

  /**
   * Checks if the participant has the brb status enabled.
   *
   * @param {ParticipantWithBrb} participant - The locus participant object.
   * @returns {boolean} - True if the participant has brb enabled, false otherwise.
   */
  isBrb: (participant: ParticipantWithBrb): boolean => participant.controls?.brb?.enabled || false,

  /**
   * @param {Object} participant - The locus participant object.
   * @param {ServerRoles} controlRole the search role
   * @returns {Boolean}
   */
  hasRole: (participant: any, controlRole: ServerRoles): boolean =>
    MemberUtil.getControlsRoles(participant)?.some(
      (role) => role.type === controlRole && role.hasRole
    ),

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  hasCohost: (participant: ParticipantWithRoles): boolean =>
    MemberUtil.hasRole(participant, ServerRoles.Cohost) || false,

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  hasModerator: (participant: ParticipantWithRoles): boolean =>
    MemberUtil.hasRole(participant, ServerRoles.Moderator) || false,

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  hasPresenter: (participant: ParticipantWithRoles): boolean =>
    MemberUtil.hasRole(participant, ServerRoles.Presenter) || false,

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {IExternalRoles}
   */
  extractControlRoles: (participant: ParticipantWithRoles): IExternalRoles => {
    const roles = {
      cohost: MemberUtil.hasCohost(participant),
      moderator: MemberUtil.hasModerator(participant),
      presenter: MemberUtil.hasPresenter(participant),
    };

    return roles;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isUser: (participant: any) => participant && participant.type === _USER_,

  isModerator: (participant) => participant && participant.moderator,

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isGuest: (participant: any) => participant && participant.guest,

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isDevice: (participant: any) => participant && participant.type === _RESOURCE_ROOM_,

  isModeratorAssignmentProhibited: (participant) =>
    participant && participant.moderatorAssignmentNotAllowed,

  isPresenterAssignmentProhibited: (participant) =>
    participant && participant.presenterAssignmentNotAllowed,

  /**
   * checks to see if the participant id is the same as the passed id
   * there are multiple ids that can be used
   * @param {Object} participant - The locus participant object.
   * @param {String} id
   * @returns {Boolean}
   */
  isSame: (participant: any, id: string) =>
    participant && (participant.id === id || (participant.person && participant.person.id === id)),

  /**
   * checks to see if the participant id is the same as the passed id for associated devices
   * there are multiple ids that can be used
   * @param {Object} participant - The locus participant object.
   * @param {String} id
   * @returns {Boolean}
   */
  isAssociatedSame: (participant: any, id: string) =>
    participant &&
    participant.associatedUsers &&
    participant.associatedUsers.some(
      (user) => user.id === id || (user.person && user.person.id === id)
    ),

  /**
   * @param {Object} participant - The locus participant object.
   * @param {Boolean} isGuest
   * @param {String} status
   * @returns {Boolean}
   */
  isNotAdmitted: (participant: any, isGuest: boolean, status: string): boolean =>
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
      !status === _IN_MEETING_),

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isAudioMuted: (participant: any) => {
    if (!participant) {
      throw new ParameterError('Audio could not be processed, participant is undefined.');
    }

    return MemberUtil.isMuted(participant, AUDIO_STATUS, AUDIO);
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isVideoMuted: (participant: any): boolean => {
    if (!participant) {
      throw new ParameterError('Video could not be processed, participant is undefined.');
    }

    return MemberUtil.isMuted(participant, VIDEO_STATUS, VIDEO);
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isHandRaised: (participant: any) => {
    if (!participant) {
      throw new ParameterError('Raise hand could not be processed, participant is undefined.');
    }

    return participant.controls?.hand?.raised || false;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isBreakoutsSupported: (participant) => {
    if (!participant) {
      throw new ParameterError(
        'Breakout support could not be processed, participant is undefined.'
      );
    }

    return !participant.doesNotSupportBreakouts;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isInterpretationSupported: (participant) => {
    if (!participant) {
      throw new ParameterError(
        'Interpretation support could not be processed, participant is undefined.'
      );
    }

    return !participant.doesNotSupportSiInterpreter;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isLiveAnnotationSupported: (participant) => {
    if (!participant) {
      throw new ParameterError(
        'LiveAnnotation support could not be processed, participant is undefined.'
      );
    }

    return !participant.annotatorAssignmentNotAllowed;
  },

  /**
   * utility method for audio/video muted status
   * @param {any} participant
   * @param {String} statusAccessor
   * @param {String} controlsAccessor
   * @returns {Boolean | undefined}
   */
  isMuted: (participant: any, statusAccessor: string, controlsAccessor: string) => {
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
  },

  /**
   * utility method for getting the recording member for later comparison
   * @param {Object} controls
   * @returns {String|null}
   */
  getRecordingMember: (controls: any) => {
    if (!controls) {
      return null;
    }
    if (controls.record && controls.record.recording && controls.record.meta) {
      return controls.record.meta.modifiedBy;
    }

    return null;
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {Boolean}
   */
  isRecording: (participant: any) => {
    if (!participant) {
      throw new ParameterError('Recording could not be processed, participant is undefined.');
    }
    if (participant.controls && participant.controls.localRecord) {
      return participant.controls.localRecord.recording;
    }

    return false;
  },

  isRemovable: (isSelf, isGuest, isInMeeting, type) => {
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
  },

  isMutable: (isSelf, isDevice, isInMeeting, isMuted, type) => {
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
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {String}
   */
  extractStatus: (participant: any) => {
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
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {String}
   */
  extractId: (participant: any) => {
    if (participant) {
      return participant.id;
    }

    return null;
  },

  /**
   * extracts the media status from nested participant object
   * @param {Object} participant - The locus participant object.
   * @returns {Object}
   */
  extractMediaStatus: (participant: any): IMediaStatus => {
    if (!participant) {
      throw new ParameterError('Media status could not be extracted, participant is undefined.');
    }

    return {
      audio: participant.status?.audioStatus,
      video: participant.status?.videoStatus,
    };
  },

  /**
   * @param {Object} participant - The locus participant object.
   * @returns {String}
   */
  extractName: (participant: any) => {
    if (participant && participant.person) {
      return participant.person.name;
    }

    return null;
  },
};
export default MemberUtil;
