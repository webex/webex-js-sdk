export interface IExternalRoles {
  cohost: boolean;
  moderator: boolean;
  presenter: boolean;
}

export enum ServerRoles {
  Cohost = 'COHOST',
  Moderator = 'MODERATOR',
  Presenter = 'PRESENTER',
}

export type ServerRoleShape = {
  type: ServerRoles;
  hasRole: boolean;
};

// values are inherited from locus so don't update these
export enum MediaStatus {
  RECVONLY = 'RECVONLY', // participant only receiving and not sending
  SENDONLY = 'SENDONLY', // participant only sending and not receiving
  SENDRECV = 'SENDRECV', // participant both sending and receiving
  INACTIVE = 'INACTIVE', // participant is not connected to media source
  UNKNOWN = 'UNKNOWN', // participant has not added media in the meeting
}

export interface IMediaStatus {
  audio: MediaStatus;
  video: MediaStatus;
}

export type Csi = number;
export type Direction = 'inactive' | 'sendrecv' | 'sendonly' | 'recvonly';
export type ParticipantUrl = string;
export interface MediaSession {
  csi: Csi;
  direction: Direction;
  mediaContent: 'main' | 'slides';
  mediaType: 'audio' | 'video';
  state: string;
}

export interface Intent {
  associatedWith: ParticipantUrl;
  id: string;
  type: string; // could be "WAIT" or "OBSERVE" or other....
}
export interface ParticipantDevice {
  correlationId: string;
  csis: Csi[];
  deviceType: string; // WDM device type, could be "WEB", "TP_ENDPOINT", "MAC" or other things, don't know the full list, so keeping it as string
  intent?: Intent;
  intents: Array<Intent | null>;
  isVideoCallback: boolean;
  mediaSessions: Array<MediaSession>;
  mediaSessionsExternal: boolean;
  state: string; // probably one of MEETING_STATE.STATES
}

// this is not a complete type, Locus may send more fields
export interface ParticipantPerson {
  id: string;
  isExternal: boolean;
  name: string;
  orgId: string;
}

export interface ParticipantMediaStatus {
  audioStatus: MediaStatus;
  videoStatus: MediaStatus;
  audioSlidesStatus?: MediaStatus;
  videoSlidesStatus?: MediaStatus;
  csis: Csi[];
}

// this is not a complete type, Locus may send more fields
export interface ParticipantControls {
  role: {
    roles: Array<ServerRoleShape>;
  };
  brb?: {
    enabled: boolean;
  };
  hand: {
    raised: boolean;
  };
  localRecord: {
    recording: boolean;
  };
}

// this is not a complete type, Locus may send more fields
export interface Participant {
  canBeController: boolean;
  controls: ParticipantControls;
  deviceUrl: string;
  devices: Array<ParticipantDevice>;
  guest: boolean;
  id: string;
  identity: string;
  identityTrustLevel: string; // could be 'INTERNAL', 'EXTERNAL' or other....
  isCreator: boolean;
  moderator: boolean; // Locus docs say this is deprecated and role control should be used instead
  moderatorAssignmentNotAllowed: boolean;
  presenterAssignmentNotAllowed: boolean;
  person: ParticipantPerson;
  resourceGuest: boolean;
  state: string; // probably one of MEETING_STATE.STATES
  status: ParticipantMediaStatus;
  type: string;
  url: ParticipantUrl;
}
