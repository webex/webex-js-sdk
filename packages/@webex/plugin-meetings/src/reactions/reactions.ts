import {Reaction, ReactionType, SkinTone, SkinToneType} from './reactions.type';

const Reactions: Record<ReactionType, Reaction> = {
  smile: {
    type: 'smile',
    codepoints: '1F642',
    shortcodes: ':slightly_smiling_face:',
  },
  sad: {
    type: 'sad',
    codepoints: '1F625',
    shortcodes: ':sad_but_relieved_face:',
  },
  wow: {
    type: 'wow',
    codepoints: '1F62E',
    shortcodes: ':open_mouth:',
  },
  haha: {
    type: 'haha',
    codepoints: '1F603',
    shortcodes: ':smiley:',
  },
  celebrate: {
    type: 'celebrate',
    codepoints: '1F389',
    shortcodes: ':party_popper:',
  },
  clap: {
    type: 'clap',
    codepoints: '1F44F',
    shortcodes: ':clap:',
  },
  thumbs_up: {
    type: 'thumb_up',
    codepoints: '1F44D',
    shortcodes: ':thumbsup:',
  },
  thumbs_down: {
    type: 'thumb_down',
    codepoints: '1F44E',
    shortcodes: ':thumbsdown:',
  },
  heart: {
    type: 'heart',
    codepoints: '2764',
    shortcodes: ':heart:',
  },
  fire: {
    type: 'fire',
    codepoints: '1F525',
    shortcodes: ':fire:',
  },
  prayer: {
    type: 'prayer',
    codepoints: '1F64F',
    shortcodes: ':pray:',
  },
  speed_up: {
    type: 'speed_up',
    codepoints: '1F407',
    shortcodes: ':rabbit:',
  },
  slow_down: {
    type: 'slow_down',
    codepoints: '1F422',
    shortcodes: ':turtle:',
  },
};

const SkinTones: Record<SkinToneType, SkinTone> = {
  normal: {
    type: 'normal_skin_tone',
    codepoints: '',
    shortcodes: '',
  },
  light: {
    type: 'light_skin_tone',
    codepoints: '1F3FB',
    shortcodes: ':skin-tone-2:',
  },
  medium_light: {
    type: 'medium_light_skin_tone',
    codepoints: '1F3FC',
    shortcodes: ':skin-tone-3:',
  },
  medium: {
    type: 'medium_skin_tone',
    codepoints: '1F3FD',
    shortcodes: ':skin-tone-4:',
  },
  medium_dark: {
    type: 'medium_dark_skin_tone',
    codepoints: '1F3FE',
    shortcodes: ':skin-tone-5:',
  },
  dark: {
    type: 'dark_skin_tone',
    codepoints: '1F3FF',
    shortcodes: ':skin-tone-6:',
  },
};

export {Reactions, SkinTones};
