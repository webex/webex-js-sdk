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
export enum ReactionType {
  smile = 'smile',
  sad = 'sad',
  wow = 'wow',
  haha = 'haha',
  celebrate = 'celebrate',
  clap = 'clap',
  thumbs_up = 'thumbs_up',
  thumbs_down = 'thumbs_down',
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

export type RelayEvent = {
  data: {
    relayType: (typeof REACTION_RELAY_TYPES)[keyof typeof REACTION_RELAY_TYPES];
    reaction: Reaction;
    sender: Sender;
  };
};

export type ProcessedReaction = {
  reaction: Reaction;
  sender: {
    id: Sender['participantId'];
    name: string;
  };
};

export type reactionCallback = (value: ProcessedReaction) => void;
