/* eslint-disable default-param-last */

import {isEqual} from 'lodash';
import {
  _IDLE_,
  _JOINED_,
  _CALL_,
  _WAIT_,
  _MOVE_MEDIA_,
  _OBSERVE_,
  _LEFT_,
  MEETING_END_REASON,
  MEDIA_STATE,
  AUDIO,
  VIDEO,
  MediaContent,
} from '../constants';
import ParameterError from '../common/errors/parameter';

const PSTN_DEVICE_TYPE = 'PROVISIONAL';

const SelfUtils = {
  /**
   * parses the relevant values for self: muted, guest, moderator, mediaStatus, state, joinedWith, pstnDevices, creator, id
   * @param {Object} self
   * @param {String} deviceId
   * @param {Array} participants
   * @returns {undefined}
   */
  parse: (self: any, deviceId: string, participants: Array<any>) => {
    if (self) {
      const joinedWith = self.devices.find((device) => deviceId === device.url);
      const pairedWith =
        joinedWith?.intent?.type === _OBSERVE_ &&
        participants?.find((participant) => participant.url === joinedWith?.intent?.associatedWith)
          ?.devices[0];

      const pstnDevices = self.devices.filter((device) => PSTN_DEVICE_TYPE === device.deviceType);

      return {
        remoteVideoMuted: SelfUtils.getRemoteVideoMuted(self),
        remoteMuted: SelfUtils.getRemoteMuted(self),
        unmuteAllowed: SelfUtils.getUnmuteAllowed(self),
        localAudioUnmuteRequested: SelfUtils.getLocalAudioUnmuteRequested(self),
        localAudioUnmuteRequestedTimeStamp: SelfUtils.getLocalAudioUnmuteRequestedTimeStamp(self),
        localAudioUnmuteRequired: SelfUtils.getLocalAudioUnmuteRequired(self),
        lastModified: SelfUtils.getLastModified(self),
        modifiedBy: SelfUtils.getModifiedBy(self),
        guest: self.guest,
        moderator: self.moderator,
        // cumulative media stats
        mediaStatus: SelfUtils.getStatus(self.status),
        // TODO: what should be the status if user has refreshed the page,
        // check the joinedWith parameter and communicate to the user
        state: self.state,
        // TODO: give a proper name . With same device as login or different login`
        // Some times we might have joined with both mobile and web
        joinedWith,
        pairedWith,
        pstnDevices,
        // current media stats is for the current device who has joined
        currentMediaStatus: SelfUtils.getMediaStatus(joinedWith?.mediaSessions),
        creator: self.isCreator, // check if its used,
        selfId: self.id,
        selfIdentity: SelfUtils.getSelfIdentity(self),
        selfUrl: self.url,
        removed: self.removed,
        roles: SelfUtils.getRoles(self),
        isUserUnadmitted: SelfUtils.isLocusUserUnadmitted(self?.state, joinedWith, pairedWith),
        layout: SelfUtils.getLayout(self),
        canNotViewTheParticipantList: SelfUtils.canNotViewTheParticipantList(self),
        isSharingBlocked: SelfUtils.isSharingBlocked(self),
        breakoutSessions: SelfUtils.getBreakoutSessions(self),
        breakout: SelfUtils.getBreakout(self),
        interpretation: SelfUtils.getInterpretation(self),
        brb: SelfUtils.getBrb(self),
      };
    }

    return null;
  },

  getBreakoutSessions: (self) => self?.controls?.breakout?.sessions,
  getBreakout: (self) => self?.controls?.breakout,
  getInterpretation: (self) => self?.controls?.interpretation,
  getBrb: (self) => self?.controls?.brb,

  getLayout: (self) =>
    Array.isArray(self?.controls?.layouts) ? self.controls.layouts[0].type : undefined,

  getRoles: (self) =>
    (self?.controls?.role?.roles || []).reduce((roles, role) => {
      if (role.hasRole) {
        roles.push(role.type);
      }

      return roles;
    }, []),

  canNotViewTheParticipantList: (self) => !!self?.canNotViewTheParticipantList,

  isSharingBlocked: (self) => !!self?.isSharingBlocked,

  getSelves: (oldParsedSelf, newSelf, deviceId, participants: Array<any>) => {
    const previous = oldParsedSelf;
    const current = newSelf && SelfUtils.parse(newSelf, deviceId, participants);
    const updates: any = {};

    updates.hasUserEnteredLobby = SelfUtils.hasUserEnteredLobby(previous, current);
    updates.hasUserBeenAdmitted = SelfUtils.hasUserBeenAdmitted(previous, current);
    updates.isVideoMutedByOthersChanged = SelfUtils.videoMutedByOthersChanged(previous, current);
    updates.isMutedByOthersChanged = SelfUtils.mutedByOthersChanged(previous, current);
    updates.localAudioUnmuteRequestedByServer = SelfUtils.localAudioUnmuteRequestedByServer(
      previous,
      current
    );
    updates.localAudioUnmuteRequiredByServer = SelfUtils.localAudioUnmuteRequiredByServer(
      previous,
      current
    );
    updates.moderatorChanged = SelfUtils.moderatorChanged(previous, current);
    updates.isRolesChanged = SelfUtils.isRolesChanged(previous, current);
    updates.isMediaInactiveOrReleased = SelfUtils.wasMediaInactiveOrReleased(previous, current);
    updates.isUserObserving = SelfUtils.isDeviceObserving(previous, current);
    updates.layoutChanged = SelfUtils.layoutChanged(previous, current);

    updates.isMediaInactive = SelfUtils.isMediaInactive(previous, current);
    updates.audioStateChange =
      previous?.currentMediaStatus.audio !== current.currentMediaStatus.audio;
    updates.videoStateChange =
      previous?.currentMediaStatus.video !== current.currentMediaStatus.video;
    updates.shareStateChange =
      previous?.currentMediaStatus.share !== current.currentMediaStatus.share;

    updates.canNotViewTheParticipantListChanged =
      previous?.canNotViewTheParticipantList !== current.canNotViewTheParticipantList;
    updates.isSharingBlockedChanged = previous?.isSharingBlocked !== current.isSharingBlocked;
    updates.breakoutsChanged = SelfUtils.breakoutsChanged(previous, current);
    updates.interpretationChanged = SelfUtils.interpretationChanged(previous, current);
    updates.brbChanged = SelfUtils.brbChanged(previous, current);

    return {
      previous,
      current,
      updates,
    };
  },

  /**
   * Checks if user has joined the meeting
   * @param {Object} self
   * @returns {boolean} isJoined
   */
  isJoined: (self: any) => self?.state === _JOINED_,

  /**
   * Validate if the Meeting Layout Controls Layout has changed.
   *
   * @param {Self} previous - Previous self state
   * @param {Self} current - Current self state [per event]
   * @returns {boolean} - If the Meeting Layout Controls Layout has changed.
   */
  layoutChanged: (previous: any, current: any) =>
    current?.layout && previous?.layout !== current?.layout,

  breakoutsChanged: (previous, current) =>
    !isEqual(previous?.breakoutSessions, current?.breakoutSessions) && !!current?.breakout,

  interpretationChanged: (previous, current) =>
    !isEqual(previous?.interpretation, current?.interpretation) && !!current?.interpretation,

  brbChanged: (previous, current) =>
    !isEqual(previous?.brb, current?.brb) && current?.brb !== undefined,

  isMediaInactive: (previous, current) => {
    if (
      previous &&
      previous.joinedWith &&
      previous.joinedWith.mediaSessions &&
      current &&
      current.joinedWith &&
      current.joinedWith.mediaSessions
    ) {
      const previousMediaStatus = SelfUtils.getMediaStatus(previous.joinedWith.mediaSessions);
      const currentMediaStatus = SelfUtils.getMediaStatus(current.joinedWith.mediaSessions);

      if (
        previousMediaStatus.audio &&
        currentMediaStatus.audio &&
        previousMediaStatus.audio.state !== MEDIA_STATE.inactive &&
        currentMediaStatus.audio.state === MEDIA_STATE.inactive &&
        currentMediaStatus.audio.direction !== MEDIA_STATE.inactive
      ) {
        return true;
      }

      if (
        previousMediaStatus.video &&
        currentMediaStatus.video &&
        previousMediaStatus.video.state !== MEDIA_STATE.inactive &&
        currentMediaStatus.video.state === MEDIA_STATE.inactive &&
        currentMediaStatus.video.direction !== MEDIA_STATE.inactive
      ) {
        return true;
      }

      if (
        previousMediaStatus.share &&
        currentMediaStatus.share &&
        previousMediaStatus.share.state !== MEDIA_STATE.inactive &&
        currentMediaStatus.share.state === MEDIA_STATE.inactive &&
        currentMediaStatus.share.direction !== MEDIA_STATE.inactive
      ) {
        return true;
      }

      return false;
    }

    return false;
  },

  getLastModified: (self) => {
    if (
      !self ||
      !self.controls ||
      !self.controls.audio ||
      !self.controls.audio.meta ||
      !self.controls.audio.meta.lastModified
    ) {
      return null;
    }

    return self.controls.audio.meta.lastModified;
  },

  getModifiedBy: (self) => {
    if (
      !self ||
      !self.controls ||
      !self.controls.audio ||
      !self.controls.audio.meta ||
      !self.controls.audio.meta.modifiedBy
    ) {
      return null;
    }

    return self.controls.audio.meta.modifiedBy;
  },

  /**
   * get the id from the self object
   * @param {Object} self
   * @returns {String}
   */
  getSelfIdentity: (self: any) => {
    if (!self || !self.person) {
      return null;
    }

    return self.person.id;
  },

  /**
   * get the "remote video mute" property from the self object
   * @param {Object} self
   * @returns {Boolean}
   */
  getRemoteVideoMuted: (self: any) => {
    if (!self || !self.controls || !self.controls.video) {
      return null;
    }

    return self.controls.video.muted;
  },

  /**
   * get the "remote mute" property from the self object
   * @param {Object} self
   * @returns {Boolean}
   */
  getRemoteMuted: (self: any) => {
    if (!self || !self.controls || !self.controls.audio) {
      return null;
    }

    return self.controls.audio.muted;
  },

  getLocalAudioUnmuteRequested: (self) => !!self?.controls?.audio?.requestedToUnmute,

  // requestedToUnmute timestamp
  getLocalAudioUnmuteRequestedTimeStamp: (self) =>
    Date.parse(self?.controls?.audio?.lastModifiedRequestedToUnmute) || 0,

  getUnmuteAllowed: (self) => {
    if (!self || !self.controls || !self.controls.audio) {
      return null;
    }

    return !self.controls.audio.disallowUnmute;
  },

  getLocalAudioUnmuteRequired: (self) => !!self?.controls?.audio?.localAudioUnmuteRequired,

  getStatus: (status) => ({
    audio: status.audioStatus,
    video: status.videoStatus,
    slides: status.videoSlidesStatus,
  }),

  /**
   * @param {Object} oldSelf
   * @param {Object} changedSelf
   * @returns {Boolean}
   */
  wasMediaInactiveOrReleased: (oldSelf: any = {}, changedSelf: any) =>
    oldSelf.joinedWith &&
    oldSelf.joinedWith.state === _JOINED_ &&
    changedSelf.joinedWith &&
    changedSelf.joinedWith.state === _LEFT_ &&
    (changedSelf.joinedWith.reason === MEETING_END_REASON.INACTIVE ||
      changedSelf.joinedWith.reason === MEETING_END_REASON.MEDIA_RELEASED),

  /**
   * @param {String | undefined} state meeting state
   * @param {any} joinedWith device that user has joined with
   * @param {any} pairedWith device that user is paired with
   * @returns {Boolean | undefined} true if user is in lobby, false if not, undefined if it cannot be determined
   */
  isLocusUserUnadmitted: (state?: string, joinedWith?: any, pairedWith?: any) => {
    if (state === undefined) {
      return undefined;
    }
    if (joinedWith?.intent?.type === _OBSERVE_ && pairedWith) {
      // we are paired with a device, so need to check the lobby state for that device
      return pairedWith.intent?.type === _WAIT_ && state === _IDLE_;
    }

    return joinedWith?.intent?.type === _WAIT_ && state === _IDLE_;
  },

  /**
   * @param {String | undefined} state meeting state
   * @param {any} joinedWith device that user has joined with
   * @param {any} pairedWith device that user is paired with
   * @returns {Boolean}
   */
  isLocusUserAdmitted: (state?: string, joinedWith?: any, pairedWith?: any) => {
    if (state === undefined) {
      return undefined;
    }

    if (joinedWith?.intent?.type === _OBSERVE_ && pairedWith) {
      // we are paired with a device, so need to check the lobby state for that device
      return pairedWith.intent?.type !== _WAIT_ && state === _JOINED_;
    }

    return joinedWith?.intent?.type !== _WAIT_ && state === _JOINED_;
  },

  /**
   * @param {Object} oldSelf
   * @param {Object} changedSelf
   * @returns {Boolean} true if user has just been placed in the lobby
   * @throws {Error} when self is undefined
   */
  hasUserEnteredLobby: (oldSelf: any, changedSelf: any) => {
    if (!changedSelf) {
      throw new ParameterError(
        'changedSelf must be defined to determine if self is unadmitted as guest.'
      );
    }

    const wasInLobby = SelfUtils.isLocusUserUnadmitted(
      oldSelf?.state,
      oldSelf?.joinedWith,
      oldSelf?.pairedWith
    );

    const isInLobby = SelfUtils.isLocusUserUnadmitted(
      changedSelf?.state,
      changedSelf?.joinedWith,
      changedSelf?.pairedWith
    );

    return !wasInLobby && isInLobby;
  },

  moderatorChanged: (oldSelf, changedSelf) => {
    if (!oldSelf) {
      return true;
    }
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if self transitioned moderator status.'
      );
    }

    return oldSelf.moderator !== changedSelf.moderator;
  },

  /**
   * determine whether the roles of self is changed or not
   * @param {Object} oldSelf
   * @param {Object} changedSelf
   * @returns {Boolean}
   */
  isRolesChanged: (oldSelf, changedSelf) => {
    if (!changedSelf) {
      // no new self means no change
      return false;
    }

    return !isEqual(oldSelf?.roles, changedSelf?.roles);
  },
  /**
   * @param {Object} oldSelf
   * @param {Object} changedSelf
   * @returns {Boolean}
   * @throws {Error} if changed self was undefined
   */
  isDeviceObserving: (oldSelf: any, changedSelf: any) =>
    oldSelf &&
    oldSelf.joinedWith?.intent?.type === _MOVE_MEDIA_ &&
    changedSelf &&
    changedSelf.joinedWith?.intent?.type === _OBSERVE_,

  /**
   * @param {Object} oldSelf
   * @param {Object} changedSelf
   * @returns {Boolean} true if the user has just been admitted from lobby into the meeting
   * @throws {Error} if changed self was undefined
   */
  hasUserBeenAdmitted: (oldSelf: any, changedSelf: any) => {
    if (!oldSelf) {
      // if there was no previous locus, it couldn't have been admitted yet
      return false;
    }
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if self transitioned to admitted as guest.'
      );
    }

    const wasInLobby = SelfUtils.isLocusUserUnadmitted(
      oldSelf?.state,
      oldSelf?.joinedWith,
      oldSelf?.pairedWith
    );

    const isAdmitted = SelfUtils.isLocusUserAdmitted(
      changedSelf?.state,
      changedSelf?.joinedWith,
      changedSelf?.pairedWith
    );

    return wasInLobby && isAdmitted && isAdmitted !== undefined;
  },

  videoMutedByOthersChanged: (oldSelf, changedSelf) => {
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if self was video muted by others.'
      );
    }

    if (!oldSelf || oldSelf.remoteVideoMuted === null) {
      if (changedSelf.remoteVideoMuted) {
        return true; // this happens when host disables "Allow start video"
      }

      // we don't want to be sending the 'meeting:self:videoUnmutedByOthers' notification on meeting join
      return false;
    }

    return oldSelf.remoteVideoMuted !== changedSelf.remoteVideoMuted;
  },

  mutedByOthersChanged: (oldSelf, changedSelf) => {
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if self was muted by others.'
      );
    }

    if (!oldSelf || oldSelf.remoteMuted === null) {
      if (changedSelf.remoteMuted) {
        return true; // this happens when mute on-entry is enabled
      }

      // we don't want to be sending the 'meeting:self:unmutedByOthers' notification on meeting join
      return false;
    }

    // there is no need to trigger user update if no one muted user
    if (changedSelf.selfIdentity === changedSelf.modifiedBy) {
      return false;
    }

    return (
      changedSelf.remoteMuted !== null &&
      (oldSelf.remoteMuted !== changedSelf.remoteMuted ||
        (changedSelf.remoteMuted && oldSelf.unmuteAllowed !== changedSelf.unmuteAllowed))
    );
  },

  localAudioUnmuteRequestedByServer: (oldSelf: any = {}, changedSelf: any) => {
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if self received request to unmute.'
      );
    }

    return (
      changedSelf.localAudioUnmuteRequested &&
      changedSelf.localAudioUnmuteRequestedTimeStamp > oldSelf.localAudioUnmuteRequestedTimeStamp
    );
  },

  localAudioUnmuteRequiredByServer: (oldSelf: any = {}, changedSelf: any) => {
    if (!changedSelf) {
      throw new ParameterError(
        'New self must be defined to determine if localAudioUnmuteRequired changed.'
      );
    }

    return (
      !changedSelf.remoteMuted &&
      changedSelf.localAudioUnmuteRequired &&
      oldSelf.localAudioUnmuteRequired !== changedSelf.localAudioUnmuteRequired
    );
  },

  /**
   * extract the sipUrl from the partner
   * @param {Object} partner
   * @param {Object} info
   * @returns {Object}
   */

  getSipUrl: (partner: any, type, sipUri) => {
    // For webex meeting the sipUrl gets updated in info parser
    if (partner && type === _CALL_) {
      return {sipUri: partner.person.sipUrl || partner.person.id};
    }

    return {sipUri};
  },

  getMediaStatus: (mediaSessions = []): {audio: any; video: any; share: any} => {
    const mediaStatus = {
      audio: {},
      video: {},
      share: {},
    };

    mediaStatus.audio = mediaSessions.find(
      (media) => media.mediaType === AUDIO && media.mediaContent === MediaContent.main
    );
    mediaStatus.video = mediaSessions.find(
      (media) => media.mediaType === VIDEO && media.mediaContent === MediaContent.main
    );
    mediaStatus.share = mediaSessions.find(
      (media) => media.mediaType === VIDEO && media.mediaContent === MediaContent.slides
    );

    return mediaStatus;
  },

  getReplacedBreakoutMoveId: (self: any, deviceId: string) => {
    if (self && Array.isArray(self.devices)) {
      const joinedDevice = self.devices.find((device) => deviceId === device.url);
      if (Array.isArray(joinedDevice?.replaces)) {
        return joinedDevice.replaces[0]?.breakoutMoveId;
      }
    }

    return null;
  },
};

export default SelfUtils;
