import {ISDKConnector} from '../SDKConnector/types';
import {LOGGER} from '../Logger/types';
import {WebexRequestPayload, SORT, DisplayInformation} from '../common/types';

export interface LoggerInterface {
  level: LOGGER;
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

export type SummaryInfo = {
  newMessages: number;
  oldMessages: number;
  newUrgentMessages: number;
  oldUrgentMessages: number;
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
    voicemailSummary?: SummaryInfo;
    voicemailTranscript?: string | null;
    error?: string;
  };
  message: string | null;
};

/**
 * Represents an interface for managing voicemail-related operations.
 */
export interface IVoicemail {
  /**
   * Retrieves the SDK connector associated with the Calling SDK.
   *
   * @returns The SDK connector as {@link ISDKConnector}.
   */
  getSDKConnector(): ISDKConnector;

  /**
   * Initializes the voicemail service and returns a voicemail response event.
   *
   * @returns A voicemail response event as {@link VoicemailResponseEvent}.
   */
  init(): VoicemailResponseEvent;

  /**
   * Retrieves a list of voicemails with optional pagination and sorting options.
   *
   * @param offset - The offset for pagination. Number of records to skip.
   * @param offsetLimit - The limit on the number of voicemails to retrieve from the offset.
   * @param sort - Sort voicemail list (eg. ASC | DESC).
   * @param refresh - Set to `true` to force a refresh of voicemail data from backend (optional).
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent}.
   * @example
   * ```typescript
   * const voicemailList = await voicemailInstance.getVoicemailList(0, 10, SORT.ASC);
   * console.log(voicemailList);
   * ```
   */
  getVoicemailList(
    offset: number,
    offsetLimit: number,
    sort: SORT,
    refresh?: boolean
  ): Promise<VoicemailResponseEvent>;

  /**
   * Retrieves the content of a voicemail message based on its messageId.
   *
   * @param messageId - The identifier of the voicemail message.
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent}.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const vmResponse = await voicemailInstance.getVoicemailContent(messageId);
   * console.log(vmResponse.voicemailContent);
   */
  getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Retrieves a quantitative summary of voicemails for a user.
   *
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent},
   *          or `null` if there is no voicemail summary available.
   * @example
   * ```
   * const vmResponse = await voicemailInstance.getVoicemailSummary();
   * console.log(vmResponse.voicemailSummary);
   * //
   * {
   *    newMessages: 1,
   *    oldMessage: 7,
   *    newUrgentMessages: 0,
   *    oldUrgentMessages: 0
   * }
   * ```
   */
  getVoicemailSummary(): Promise<VoicemailResponseEvent | null>;

  /**
   * Marks a voicemail message as read based on its message identifier.
   *
   * @param messageId - The identifier of the voicemail message to mark as read.
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent}.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * await voicemailInstance.voicemailMarkAsRead(messageId);
   * ```
   */
  voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Marks a voicemail message as unread based on its message identifier.
   *
   * @param messageId - The identifier of the voicemail message to mark as unread.
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent}.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * await voicemailInstance.voicemailMarkAsUnread(messageId);
   * ```
   */
  voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Deletes a voicemail message based on its message identifier.
   *
   * @param messageId - The identifier of the voicemail message to delete.
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent}.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * await voicemailInstance.deleteVoicemail(messageId);
   * ```
   */
  deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Retrieves the transcript of a voicemail message based on its message identifier.
   *
   * @param messageId - The identifier of the voicemail message.
   * @returns A promise that resolves to a voicemail response event as {@link VoicemailResponseEvent},
   *          or `null` if there is no voicemail transcript available.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.getVMTranscript(messageId);
   * console.log(voicemailResponse.voicemailTranscript);
   * ```
   */
  getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null>;

  /**
   * Resolves contact information based on calling party information.
   *
   * @param callingPartyInfo - The calling party information for contact resolution.
   * @returns A promise that resolves to contact information as {@link DisplayInformation},
   *          or `null` if contact resolution is unsuccessful.
   *  * @example
   * ```typescript
   * const callingPartyInfo = { userId: "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wZmVh" };
   * const contactInfo = await voicemailInstance.resolveContact(callingPartyInfo);
   * console.log(contactInfo);
   * ```
   */
  resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null>;
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
