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
