import {ISDKConnector} from '../SDKConnector/types';
import {LOGGER} from '../Logger/types';
import {WebexRequestPayload, SORT, DisplayInformation} from '../common/types';

export interface LoggerInterface {
  level: LOGGER;
}

export enum CALLING_BACKEND {
  WXC = 'WEBEX_CALLING',
  BWRKS = 'BROADWORKS_CALLING',
  UCM = 'UCM_CALLING',
  INVALID = 'Calling backend is currently not supported',
}

export type BroadworksTokenType = {
  token: {
    bearer: string;
  };
};

export type ResponseString$ = {
  $: string;
};

export type ResponseNumber$ = {
  $: number;
};

export type CallingPartyInfo = {
  name: ResponseString$;
  userId?: ResponseString$;
  address: ResponseString$;
  userExternalId?: ResponseString$;
};

export type MessageInfo = {
  duration: ResponseString$;
  callingPartyInfo: CallingPartyInfo;
  time: ResponseNumber$;
  messageId: ResponseString$;
  read: ResponseString$ | object;
};

export type FilteredVoicemail = {
  messages: MessageInfo[];
  moreVMAvailable: boolean;
};

export type VoicemailList = {
  VoiceMessagingMessages: {
    messageInfoList: {
      messageInfo: MessageInfo[];
    };
  };
};

export type VoicemailResponseEvent = {
  statusCode: number;
  data: {
    voicemailList?: MessageInfo[];
    voicemailContent?: {
      type: string | null;
      content: string | null;
    };
    voicemailTranscript?: string | null;
    error?: string;
  };
  message: string;
};

export interface IVoicemail {
  getSDKConnector: () => ISDKConnector;
  init: () => VoicemailResponseEvent;
  getVoicemailList: (
    offset: number,
    offsetLimit: number,
    sort: SORT,
    refresh?: boolean
  ) => Promise<VoicemailResponseEvent>;
  getVoicemailContent: (messageId: string) => Promise<VoicemailResponseEvent>;
  voicemailMarkAsRead: (messageId: string) => Promise<VoicemailResponseEvent>;
  voicemailMarkAsUnread: (messageId: string) => Promise<VoicemailResponseEvent>;
  deleteVoicemail: (messageId: string) => Promise<VoicemailResponseEvent>;
  getVMTranscript: (messageId: string) => Promise<VoicemailResponseEvent | null>;
  resolveContact: (callingPartyInfo: CallingPartyInfo) => Promise<DisplayInformation | null>;
}

export interface IWxCallBackendConnector extends IVoicemail {
  xsiEndpoint: WebexRequestPayload;
  userId: string;
}

export interface IBroadworksCallBackendConnector extends IVoicemail {
  xsiEndpoint: WebexRequestPayload;
  userId: string;
  bwtoken: string;
  xsiAccessToken: string;
}

export interface IUcmBackendConnector extends IVoicemail {
  userId: string;
}

export type From = {
  DisplayName: string;
  SmtpAddress: string;
  DtmfAccessId: string;
};

export type CallerId = {
  CallerNumber: string;
  CallerName: string;
};

export type UcmVmMessageInfo = {
  Subject: string;
  Read: string;
  Dispatch: string;
  Secure: string;
  Priority: string;
  Sensitivity: string;
  URI: string;
  MsgId: string;
  From: From;
  CallerId: CallerId;
  ArrivalTime: string;
  Size: string;
  Duration: string;
  IMAPUid: string;
  FromSub: string;
  MsgType: string;
};

export type UcmVMContentResponse = {
  data?: string;
};

export type UcmVMResponse = {
  '@total': string;
  Message: UcmVmMessageInfo;
};

export type MessageId = {
  messageId: string;
  eventType: string;
  status: string;
};

export type VoicemailEvent = {
  data: MessageId;
  filterMessage: boolean;
  id: string;
  sequenceNumber: number;
  timestamp: number;
  trackingId: string;
};
