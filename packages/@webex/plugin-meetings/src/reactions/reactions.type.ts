import {REACTION_RELAY_TYPES} from './constants';

export type EmoticonData = {
  type: string;
  codepoints?: string;
  shortcodes?: string;
};

export type SkinTone = EmoticonData;

export type Reaction = EmoticonData & {
  tone?: SkinTone;
};

// eslint-disable-next-line no-shadow
export enum ReactionServerType {
  smile = 'smile',
  sad = 'sad',
  wow = 'wow',
  haha = 'haha',
  celebrate = 'celebrate',
  clap = 'clap',
  thumb_up = 'thumb_up',
  thumb_down = 'thumb_down',
  heart = 'heart',
  fire = 'fire',
  prayer = 'prayer',
  speed_up = 'speed_up',
  slow_down = 'slow_down',
}

// eslint-disable-next-line no-shadow
export enum SkinToneType {
  normal = 'normal',
  light = 'light',
  medium_light = 'medium_light',
  medium = 'medium',
  medium_dark = 'medium_dark',
  dark = 'dark',
}

export type Sender = {
  participantId: string;
};

export type ProcessedReaction = {
  reaction: Reaction;
  sender: {
    id: Sender['participantId'];
    name: string;
  };
};

type RelayEventData = {
  relayType: (typeof REACTION_RELAY_TYPES)['REACTION'];
  reaction: Reaction;
  sender: Sender;
};

export type RelayEvent = {
  data: RelayEventData;
};
