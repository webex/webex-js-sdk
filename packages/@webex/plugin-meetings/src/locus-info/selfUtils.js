
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
  MediaContent
} from '../constants';
import ParameterError from '../common/errors/parameter';

const SelfUtils = {};
const PSTN_DEVICE_TYPE = 'PROVISIONAL';

/**
 * parses the relevant values for self: muted, guest, moderator, mediaStatus, state, joinedWith, pstnDevices, creator, id
 * @param {Object} self
 * @param {String} deviceId
 * @returns {undefined}
 */
SelfUtils.parse = (self, deviceId) => {
  if (self) {
    const joinedWith = self.devices.find((device) => deviceId === device.url);
    const pstnDevices = self.devices.filter((device) => PSTN_DEVICE_TYPE === device.deviceType);

    return {
      remoteMuted: SelfUtils.getRemoteMuted(self),
      unmuteAllowed: SelfUtils.getUnmuteAllowed(self),
      localAudioUnmuteRequested: SelfUtils.getLocalAudioUnmuteRequested(self),
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
      pstnDevices,
      // current media stats is for the current device who has joined
      currentMediaStatus: SelfUtils.getMediaStatus(
        joinedWith?.mediaSessions
      ),
      creator: self.isCreator, // check if its used,
      selfId: self.id,
      selfIdentity: SelfUtils.getSelfIdentity(self),
      selfUrl: self.url,
      removed: self.removed,
      roles: SelfUtils.getRoles(self),
      isUserUnadmitted: self.state === _IDLE_ && joinedWith?.intent?.type === _WAIT_,
      layout: SelfUtils.getLayout(self)
    };
  }

  return null;
};

SelfUtils.getLayout = (self) => (Array.isArray(self?.controls?.layouts) ? self.controls.layouts[0].type : undefined);

SelfUtils.getRoles = (self) => (self?.controls?.role?.roles || []).reduce((roles, role) => {
  if (role.hasRole) {
    roles.push(role.type);
  }

  return roles;
}, []);

SelfUtils.getSelves = (oldSelf, newSelf, deviceId) => {
  const previous = oldSelf && SelfUtils.parse(oldSelf, deviceId);
  const current = newSelf && SelfUtils.parse(newSelf, deviceId);
  const updates = {};

  updates.isUserUnadmitted = SelfUtils.isUserUnadmitted(current);
  updates.isUserAdmitted = SelfUtils.isUserAdmitted(previous, current);
  updates.isMutedByOthersChanged = SelfUtils.mutedByOthersChanged(previous, current);
  updates.localAudioUnmuteRequestedByServer = SelfUtils.localAudioUnmuteRequestedByServer(previous, current);
  updates.localAudioUnmuteRequiredByServer = SelfUtils.localAudioUnmuteRequiredByServer(previous, current);
  updates.moderatorChanged = SelfUtils.moderatorChanged(previous, current);
  updates.isMediaInactiveOrReleased = SelfUtils.wasMediaInactiveOrReleased(previous, current);
  updates.isUserObserving = SelfUtils.isDeviceObserving(previous, current);
  updates.layoutChanged = SelfUtils.layoutChanged(previous, current);

  updates.isMediaInactive = SelfUtils.isMediaInactive(previous, current);
  updates.audioStateChange = previous?.currentMediaStatus.audio !== current.currentMediaStatus.audio;
  updates.videoStateChange = previous?.currentMediaStatus.video !== current.currentMediaStatus.video;
  updates.shareStateChange = previous?.currentMediaStatus.share !== current.currentMediaStatus.share;

  return {
    previous,
    current,
    updates
  };
};

/**
 * Checks if user has joined the meeting
 * @param {Object} self
 * @returns {boolean} isJoined
*/
SelfUtils.isJoined = (self) => self?.state === _JOINED_;

/**
 * Validate if the Meeting Layout Controls Layout has changed.
 *
 * @param {Self} previous - Previous self state
 * @param {Self} current - Current self state [per event]
 * @returns {boolean} - If the MEeting Layout Controls Layout has changed.
 */
SelfUtils.layoutChanged = (previous, current) => current?.layout && previous?.layout !== current?.layout;


SelfUtils.isMediaInactive = (previous, current) => {
  if (
    previous &&
    previous.joinedWith &&
    previous.joinedWith.mediaSessions &&
    current &&
    current.joinedWith &&
    current.joinedWith.mediaSessions
  ) {
    const previousMediaStatus = SelfUtils.getMediaStatus(
      previous.joinedWith.mediaSessions
    );
    const currentMediaStatus = SelfUtils.getMediaStatus(
      current.joinedWith.mediaSessions
    );

    if (
      previousMediaStatus.audio && currentMediaStatus.audio &&
      previousMediaStatus.audio.state !== MEDIA_STATE.inactive &&
      currentMediaStatus.audio.state === MEDIA_STATE.inactive &&
      currentMediaStatus.audio.direction !== MEDIA_STATE.inactive
    ) {
      return true;
    }

    if (
      previousMediaStatus.video && currentMediaStatus.video &&
      previousMediaStatus.video.state !== MEDIA_STATE.inactive &&
      currentMediaStatus.video.state === MEDIA_STATE.inactive &&
      currentMediaStatus.video.direction !== MEDIA_STATE.inactive
    ) {
      return true;
    }

    if (
      previousMediaStatus.share && currentMediaStatus.share &&
      previousMediaStatus.share.state !== MEDIA_STATE.inactive &&
      currentMediaStatus.share.state === MEDIA_STATE.inactive &&
      currentMediaStatus.share.direction !== MEDIA_STATE.inactive
    ) {
      return true;
    }

    return false;
  }

  return false;
};

SelfUtils.getLastModified = (self) => {
  if (!self || !self.controls || !self.controls.audio || !self.controls.audio.meta || !self.controls.audio.meta.lastModified) {
    return null;
  }

  return self.controls.audio.meta.lastModified;
};

SelfUtils.getModifiedBy = (self) => {
  if (!self || !self.controls || !self.controls.audio || !self.controls.audio.meta || !self.controls.audio.meta.modifiedBy) {
    return null;
  }

  return self.controls.audio.meta.modifiedBy;
};

/**
 * get the id from the self object
 * @param {Object} self
 * @returns {String}
 */
SelfUtils.getSelfIdentity = (self) => {
  if (!self && !self.person) {
    return null;
  }

  return self.person.id;
};

/**
 * get the "remote mute" property from the self object
 * @param {Object} self
 * @returns {Boolean}
 */
SelfUtils.getRemoteMuted = (self) => {
  if (!self || !self.controls || !self.controls.audio) {
    return null;
  }

  return self.controls.audio.muted;
};

SelfUtils.getLocalAudioUnmuteRequested = (self) => !!self?.controls?.audio?.requestedToUnmute;

SelfUtils.getUnmuteAllowed = (self) => {
  if (!self || !self.controls || !self.controls.audio) {
    return null;
  }

  return !self.controls.audio.disallowUnmute;
};


SelfUtils.getLocalAudioUnmuteRequired = (self) => !!self?.controls?.audio?.localAudioUnmuteRequired;

SelfUtils.getStatus = (status) => ({
  audio: status.audioStatus,
  video: status.videoStatus,
  slides: status.videoSlidesStatus
});


/**
 * @param {Object} oldSelf
 * @param {Object} changedSelf
 * @returns {Boolean}
 */
SelfUtils.wasMediaInactiveOrReleased = (oldSelf = {}, changedSelf) => oldSelf.joinedWith && oldSelf.joinedWith.state === _JOINED_ && changedSelf.joinedWith.state === _LEFT_ &&
 (changedSelf.joinedWith.reason === MEETING_END_REASON.INACTIVE || changedSelf.joinedWith.reason === MEETING_END_REASON.MEDIA_RELEASED);


/**
 * @param {Object} check
 * @returns {Boolean}
 */
SelfUtils.isLocusUserUnadmitted = (check) => check && check.joinedWith?.intent?.type === _WAIT_ && check.state === _IDLE_;

/**
 * @param {Object} check
 * @returns {Boolean}
 */
SelfUtils.isLocusUserAdmitted = (check) => check && check.joinedWith?.intent?.type !== _WAIT_ && check.state === _JOINED_;

/**
 * @param {Object} self
 * @returns {Boolean}
 * @throws {Error} when self is undefined
 */
SelfUtils.isUserUnadmitted = (self) => {
  if (!self) {
    throw new ParameterError('self must be defined to determine if self is unadmitted as guest.');
  }

  return SelfUtils.isLocusUserUnadmitted(self);
};

SelfUtils.moderatorChanged = (oldSelf, changedSelf) => {
  if (!oldSelf) {
    return true;
  }
  if (!changedSelf) {
    throw new ParameterError('New self must be defined to determine if self transitioned moderator status.');
  }

  return oldSelf.moderator !== changedSelf.moderator;
};


/**
 * @param {Object} oldSelf
 * @param {Object} changedSelf
 * @returns {Boolean}
 * @throws {Error} if changed self was undefined
 */
SelfUtils.isDeviceObserving = (oldSelf, changedSelf) => oldSelf && oldSelf.joinedWith?.intent?.type === _MOVE_MEDIA_ && changedSelf && changedSelf.joinedWith?.intent?.type === _OBSERVE_;

/**
 * @param {Object} oldSelf
 * @param {Object} changedSelf
 * @returns {Boolean}
 * @throws {Error} if changed self was undefined
 */
SelfUtils.isUserAdmitted = (oldSelf, changedSelf) => {
  if (!oldSelf) {
    // if there was no previous locus, it couldn't have been admitted yet
    return false;
  }
  if (!changedSelf) {
    throw new ParameterError('New self must be defined to determine if self transitioned to admitted as guest.');
  }

  return SelfUtils.isLocusUserUnadmitted(oldSelf) && SelfUtils.isLocusUserAdmitted(changedSelf);
};

SelfUtils.mutedByOthersChanged = (oldSelf, changedSelf) => {
  if (!changedSelf) {
    throw new ParameterError('New self must be defined to determine if self was muted by others.');
  }

  if (!oldSelf || (oldSelf.remoteMuted === null)) {
    if (changedSelf.remoteMuted) {
      return true; // this happens when mute on-entry is enabled
    }

    // we don't want to be sending the 'meeting:self:unmutedByOthers' notification on meeting join
    return false;
  }

  return (changedSelf.remoteMuted !== null) &&
    ((oldSelf.remoteMuted !== changedSelf.remoteMuted) || (changedSelf.remoteMuted && (oldSelf.unmuteAllowed !== changedSelf.unmuteAllowed)));
};

SelfUtils.localAudioUnmuteRequestedByServer = (oldSelf = {}, changedSelf) => {
  if (!changedSelf) {
    throw new ParameterError('New self must be defined to determine if self received request to unmute.');
  }

  return changedSelf.localAudioUnmuteRequested && !oldSelf.localAudioUnmuteRequested;
};


SelfUtils.localAudioUnmuteRequiredByServer = (oldSelf = {}, changedSelf) => {
  if (!changedSelf) {
    throw new ParameterError('New self must be defined to determine if localAudioUnmuteRequired changed.');
  }

  return !changedSelf.remoteMuted && changedSelf.localAudioUnmuteRequired && (oldSelf.localAudioUnmuteRequired !== changedSelf.localAudioUnmuteRequired);
};

/**
 * extract the sipUrl from the partner
 * @param {Object} partner
 * @param {Object} info
 * @returns {Object}
 */

SelfUtils.getSipUrl = (partner, type, sipUri) => {
  // For webex meeting the sipUrl gets updated in info parser
  if (partner && type === _CALL_) {
    return {sipUri: partner.person.sipUrl || partner.person.id};
  }

  return {sipUri};
};

SelfUtils.getMediaStatus = (mediaSessions = []) => {
  const mediaStatus = {
    audio: {},
    video: {},
    share: {}
  };

  mediaStatus.audio = mediaSessions.find((media) => media.mediaType === AUDIO && media.mediaContent === MediaContent.main);
  mediaStatus.video = mediaSessions.find((media) => media.mediaType === VIDEO && media.mediaContent === MediaContent.main);
  mediaStatus.share = mediaSessions.find((media) => media.mediaType === VIDEO && media.mediaContent === MediaContent.slides);

  return mediaStatus;
};


export default SelfUtils;
