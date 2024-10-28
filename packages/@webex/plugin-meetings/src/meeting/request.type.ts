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

export type StepAwayOptions = {
  enabled: boolean;
  locusUrl: string;
  deviceUrl: string;
  selfId: string;
};
