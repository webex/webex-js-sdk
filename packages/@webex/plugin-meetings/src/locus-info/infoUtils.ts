import {SELF_ROLES, DISPLAY_HINTS, INTERSTITIAL_DISPLAY_HINTS} from '../constants';

// these values have to match what Locus sends us
export enum DisplayHintSection {
  JOINED = 'joined',
  MODERATOR = 'moderator',
  COHOST = 'coHost',
  PRESENTER = 'presenter',
  PANELIST = 'panelist',
  ATTENDEE = 'attendee',
}

const InfoUtils: any = {};

InfoUtils.parse = (info, roles, isJoined = true) => {
  const parsed: any = {
    policy: InfoUtils.parsePolicy(info),
    moderator: InfoUtils.parseModerator(info),
    coHost: InfoUtils.parseCoHost(info),
    presenter: InfoUtils.parsePresenter(info),
    panelist: InfoUtils.parsePanelist(info),
    attendee: InfoUtils.parseAttendee(info),
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

  if (roles.includes(SELF_ROLES.PRESENTER)) {
    userDisplayHints = {...userDisplayHints, ...parsed.presenter};
  }

  if (roles.includes(SELF_ROLES.PANELIST)) {
    userDisplayHints = {...userDisplayHints, ...parsed.panelist};
  }

  if (roles.includes(SELF_ROLES.ATTENDEE)) {
    userDisplayHints = {...userDisplayHints, ...parsed.attendee};
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

InfoUtils.parseDisplayHintSection = (info: any, displayHintKey: DisplayHintSection) => {
  const displayHints: Record<string, boolean> = {};

  if (
    info &&
    info.displayHints &&
    info.displayHints[displayHintKey] &&
    info.displayHints[displayHintKey].length > 0
  ) {
    info.displayHints[displayHintKey].forEach((key: any) => {
      displayHints[key] = true;
    });
  }

  return displayHints;
};

InfoUtils.parsePolicy = (info) =>
  InfoUtils.parseDisplayHintSection(info, DisplayHintSection.JOINED);

InfoUtils.parseModerator = (info) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, DisplayHintSection.MODERATOR);

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.parseCoHost = (info) => {
  const displayHints = InfoUtils.parseDisplayHintSection(info, DisplayHintSection.COHOST);

  return {...displayHints, [DISPLAY_HINTS.LOWER_SOMEONE_ELSES_HAND]: true};
};

InfoUtils.parsePresenter = (info) =>
  InfoUtils.parseDisplayHintSection(info, DisplayHintSection.PRESENTER);

InfoUtils.parsePanelist = (info) =>
  InfoUtils.parseDisplayHintSection(info, DisplayHintSection.PANELIST);

InfoUtils.parseAttendee = (info) =>
  InfoUtils.parseDisplayHintSection(info, DisplayHintSection.ATTENDEE);

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
