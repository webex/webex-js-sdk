import {Enum} from '../constants';

export const TurnDiscoverySkipReason = {
  missingHttpResponse: 'missing http response', // when we asked for the TURN discovery response to be in the http response, but it wasn't there
  reachability: 'reachability', // when udp reachability to public clusters is ok, so we don't need TURN (this doens't apply when joinWithMedia() is used)
  alreadyInProgress: 'already in progress', // when we try to start TURN discovery while it's already in progress
} as const;

export type TurnDiscoverySkipReason =
  | Enum<typeof TurnDiscoverySkipReason> // this is a kind of FYI, because in practice typescript will infer the type of TurnDiscoverySkipReason as a string
  | string // used in case of errors, contains the error message
  | undefined; // used when TURN discovery is not skipped

export type TurnServerInfo = {
  urls: string[];
  username: string;
  password: string;
};

export type TurnDiscoveryResult = {
  turnServerInfo?: TurnServerInfo;
  turnDiscoverySkippedReason: TurnDiscoverySkipReason;
};
