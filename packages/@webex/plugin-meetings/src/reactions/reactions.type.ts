export type EmoticonData = {
  type: string;
  codepoints?: string;
  shortcodes?: string;
};

export type SkinTone = EmoticonData;
// @ts-ignore
export type Reaction = EmoticonData & {
  tone?: SkinTone;
};

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

export enum SkinToneType {
  normal = 'normal',
  light = 'light',
  medium_light = 'medium_light',
  medium = 'medium',
  medium_dark = 'medium_dark',
  dark = 'dark',
}
