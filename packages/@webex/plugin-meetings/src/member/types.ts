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

export type ParticipantWithRoles = {
  controls: {
    role: {
      roles: Array<ServerRoleShape>;
    };
  };
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
  audio: MediaStatus | null;
  video: MediaStatus | null;
}
