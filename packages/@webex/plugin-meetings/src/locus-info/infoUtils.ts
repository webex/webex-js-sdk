import {SELF_ROLES, DISPLAY_HINTS} from '../constants';

const InfoUtils: any = {};

InfoUtils.parse = (info, roles, isJoined = true) => {
  const parsed: any = {
    policy: InfoUtils.parsePolicy(info),
    moderator: InfoUtils.parseModerator(info),
    coHost: InfoUtils.parseCoHost(info),
  };

  let userDisplayHints = isJoined ? {...parsed.policy} : {};

  if (roles.includes(SELF_ROLES.COHOST)) {
    userDisplayHints = {...userDisplayHints, ...parsed.coHost};
  }

  if (roles.includes(SELF_ROLES.MODERATOR)) {
    userDisplayHints = {...userDisplayHints, ...parsed.moderator};
  }

  parsed.userDisplayHints = Object.keys(userDisplayHints);

  if (info.sipUri) {
    parsed.sipUri = info.sipUri;
  }

  if (info.meetingId) {
    parsed.meetingNumber = info.meetingId;
  }

  return parsed;
};

InfoUtils.parseDisplayHintSection = (info, displayHintKey) => {
  const displayHints = {};

  if (
    info &&
    info.displayHints &&
    info.displayHints[displayHintKey] &&
    info.displayHints[displayHintKey].length > 0
  ) {
    info.displayHints[displayHintKey].forEach((key) => {
      displayHints[key] = true;
    });
  }

  return displayHints;
};

InfoUtils.parsePolicy = (info) => InfoUtils.parseDisplayHintSection(info, 'joined');

InfoUtils.parseModerator = (info) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, 'moderator');

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.parseCoHost = (info) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, 'coHost');

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.isLocked = (policy) => policy.LOCK_STATUS_LOCKED || false;

InfoUtils.isUnlocked = (policy) => policy.LOCK_STATUS_UNLOCKED || false;

InfoUtils.getInfos = (oldInfo, newInfo, roles, isJoined) => {
  let previous = null;

  if (oldInfo) {
    previous = oldInfo;
  }
  const current = newInfo && InfoUtils.parse(newInfo, roles, isJoined);
  const updates: any = {};

  if (current) {
    current.isLocked = InfoUtils.isLocked(current.policy);
    current.isUnlocked = InfoUtils.isUnlocked(current.policy);

    if ((previous && previous.isUnlocked && current.isLocked) || (!previous && current.isLocked)) {
      updates.isLocked = current.isLocked;
    }
    if (
      (previous && previous.isLocked && current.isUnlocked) ||
      (!previous && current.isUnlocked)
    ) {
      updates.isUnlocked = current.isUnlocked;
    }
  }

  return {
    previous,
    current,
    updates,
  };
};

export default InfoUtils;
