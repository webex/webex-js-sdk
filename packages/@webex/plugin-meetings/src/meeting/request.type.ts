import {Reaction} from '../reactions/reactions.type';

export type SendReactionOptions = {
  reactionChannelUrl: string;
  reaction: Reaction;
  participantId: string;
};

export type ToggleReactionsOptions = {
  enable: boolean;
  locusUrl: string;
  requestingParticipantId: string;
};

export type BrbOptions = {
  enabled: boolean;
  locusUrl: string;
  deviceUrl: string;
  selfId: string;
};

export type PostMeetingDataConsentOptions = {
  postMeetingDataConsent: boolean;
  locusUrl: string;
  deviceUrl: string;
  selfId: string;
};

export type StageCustomLogoPositions =
  | 'LowerLeft'
  | 'LowerMiddle'
  | 'LowerRight'
  | 'UpperLeft'
  | 'UpperMiddle'
  | 'UpperRight';

export type StageNameLabelType = 'Primary' | 'PrimaryInverted' | 'Secondary' | 'SecondaryInverted';

export type StageCustomBackground = {
  url: string;
  [others: string]: unknown;
};

export type StageCustomLogo = {
  url: string;
  position: StageCustomLogoPositions;
  [others: string]: unknown;
};

export type StageCustomNameLabel = {
  accentColor: string;
  background: {color: string};
  border: {color: string};
  content: {displayName: {color: string}; subtitle: {color: string}};
  decoration: {color: string};
  fadeOut?: {delay: number};
  type: StageNameLabelType;
  [others: string]: unknown;
};

export type SetStageOptions = {
  activeSpeakerProportion?: number;
  customBackground?: StageCustomBackground;
  customLogo?: StageCustomLogo;
  customNameLabel?: StageCustomNameLabel;
  importantParticipants?: {mainCsi: number; participantId: string}[];
  lockAttendeeViewOnStage?: boolean;
  showActiveSpeaker?: boolean;
};

export type SetStageVideoLayout = {
  overrideDefault: true;
  lockAttendeeViewOnStageOnly: boolean;
  stageParameters: {
    importantParticipants?: {participantId: string; mainCsi: number; order: number}[];
    showActiveSpeaker: {show: boolean; order: number};
    activeSpeakerProportion: number;
    stageManagerType: number;
  };
  customLayouts?: {
    background?: StageCustomBackground;
    logo?: StageCustomLogo;
  };
  nameLabelStyle?: StageCustomNameLabel;
};

export type UnsetStageVideoLayout = {
  overrideDefault: false;
};

export type SynchronizeVideoLayout = SetStageVideoLayout | UnsetStageVideoLayout;
