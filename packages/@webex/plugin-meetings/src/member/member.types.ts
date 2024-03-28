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
