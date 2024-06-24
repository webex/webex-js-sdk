import {SELF_ROLES, DISPLAY_HINTS, INTERSTITIAL_DISPLAY_HINTS} from '../constants';

const InfoUtils: Record<string, any> = {};

InfoUtils.parse = (info: Record<string, any>, roles: string[], isJoined = true) => {
  const parsed: any = {
    policy: InfoUtils.parsePolicy(info),
    moderator: InfoUtils.parseModerator(info),
    coHost: InfoUtils.parseCoHost(info),
  };

  let userDisplayHints = isJoined
    ? {...parsed.policy}
    : {
        ...Object.fromEntries(
          Object.entries(parsed.policy).filter(([hint]) =>
            INTERSTITIAL_DISPLAY_HINTS.includes(hint)
          )
        ),
      };

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

  if (info.datachannelUrl) {
    parsed.datachannelUrl = info.datachannelUrl;
  }

  return parsed;
};

InfoUtils.parseDisplayHintSection = (info: Record<string, any>, displayHintKey: string) => {
  const displayHints: Record<string, any> = {};

  if (
    info &&
    info.displayHints &&
    info.displayHints[displayHintKey] &&
    info.displayHints[displayHintKey].length > 0
  ) {
    info.displayHints[displayHintKey].forEach((key: string) => {
      displayHints[key] = true;
    });
  }

  return displayHints;
};

InfoUtils.parsePolicy = (info: unknown) => InfoUtils.parseDisplayHintSection(info, 'joined');

InfoUtils.parseModerator = (info: unknown) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, 'moderator');

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.parseCoHost = (info: unknown) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, 'coHost');

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.isLocked = (policy: Record<string, string>) => policy.LOCK_STATUS_LOCKED || false;

InfoUtils.isUnlocked = (policy: Record<string, string>) => policy.LOCK_STATUS_UNLOCKED || false;

InfoUtils.getInfos = (
  oldInfo: Record<string, any>,
  newInfo: unknown,
  roles: string[],
  isJoined: boolean
) => {
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
