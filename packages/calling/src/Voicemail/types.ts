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
 * Interface for the Voicemail Module.
 * This interface provides a set of APIs for retrieving and updating voicemail, including operations such as retrieving voicemail lists, messages count summary, marking as read/unread, and accessing voicemail transcripts.
 *
 * These APIs return promises that resolve to a `VoicemailResponseEvent` object, which includes a status code, data, and message.
 * The data field within this response object may contain various objects, with different types depending on the specific API used.
 *
 * @example
 * A successful response will be structured as follows:
 * ```json
 * {
 *    statusCode: 200,
 *    data: {
 *      voicemailTranscript: "Example"
 *    },
 *    message: 'SUCCESS'
 * }
 * ```

 * A failure response will be structured as follows:
 * ```json
 * {
 *    statusCode: 503,
 *    data: {
 *        error: "Failure reason"
 *    },
 *    message: 'FAILURE'
 * }
 * ```
 */
export interface IVoicemail {
  /**
   * Retrieves the SDK connector associated with the Calling SDK.
   * @ignore
   */
  getSDKConnector(): ISDKConnector;

  /**
   * Initializes the voicemail service and returns a voicemail response event.
   *
   */
  init(): VoicemailResponseEvent;

  /**
   * Retrieves a list of voicemails with optional pagination and sorting options.
   * Received data can be accessed through `data.voicemailList`
   *
   * @param offset - The offset for pagination. Number of records to skip.
   * @param offsetLimit - The limit on the number of voicemails to retrieve from the offset.
   * @param sort - Sort voicemail list (eg. ASC | DESC).
   * @param refresh - Set to `true` to force a refresh of voicemail data from backend (optional).
   *
   * @example
   * ```typescript
   * const voicemailResponse = await voicemailInstance.getVoicemailList(0, 10, SORT.ASC);
   * ```
   * The `voicemailResponse` object will have `voicemailList` object as properties in data attribute.
   *
   * ```json
   * {
   *    statusCode: 200,
   *    data: {
   *        voicemailList: [messages]
   *    }
   * }
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
   * Received data can be accessed through `data.voicemailContent`
   *
   * @param messageId - The identifier of the voicemail message.
   * @example
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.getVoicemailContent(messageId);
   * ```
   * The `voicemailResponse` object will have `voicemailContent` object as properties in data attribute.
   *
   * ```json
   * {
   *    statusCode: 200,
   *    data: {
   *        voicemailContent: {
   *          type: 'message',
   *          content: 'something'
   *        }
   *    }
   * }
   * ```
   */
  getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Retrieves a quantitative summary of voicemails for a user.
   * Received data can be accessed through `data.voicemailSummary`
   *
   * @example
   * ```
   * const voicemailResponse = await voicemailInstance.getVoicemailSummary();
   * ```
   * The `voicemailResponse` object will have `voicemailSummary` object as properties in data attribute.
   *
   * ```json
   * {
   *    statusCode: 200,
   *    data: {
   *        voicemailSummary: {
   *          newMessages: 1,
   *          oldMessage: 7,
   *          newUrgentMessages: 0,
   *          oldUrgentMessages: 0
   *        }
   *    }
   * }
   * ```
   */
  getVoicemailSummary(): Promise<VoicemailResponseEvent | null>;

  /**
   * Marks a voicemail message as read based on its message identifier.
   * Note: Response will have a `statusCode` and `message`. But `data` attribute is not returned in the response unless it is
   * an error response in that case   `data` will have `error` attribute.
   *
   * @param messageId - The identifier of the voicemail message to mark as read.
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.voicemailMarkAsRead(messageId);
   * ```
   * The `voicemailResponse` object will be populated as below:
   *
   * ```json
   * {
   *    statusCode: 200,
   *    message: "SUCCESS"
   * }
   * ```
   * The `voicemailResponse` object will be populated as below in case of error response:
   *
   * ```json
   * {
   *    statusCode: 404,
   *    message: "FAILURE"
   *    data: {
   *      error: "Failure reason"
   *    }
   * }
   */
  voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Marks a voicemail message as unread based on its message identifier.
   * Note: Response will have a `statusCode` and `message`. But `data` attribute is not returned in the response unless it is
   * an error response in that case   `data` will have `error` attribute.
   *
   * @param messageId - The identifier of the voicemail message to mark as unread.
   * @example
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.voicemailMarkAsUnread(messageId);
   * ```
   * The `voicemailResponse` object will be populated as below:
   *
   * ```json
   * {
   *    statusCode: 200,
   *    message: "SUCCESS"
   * }
   * ```
   */
  voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Deletes a voicemail message based on its message identifier.
   * Note: Response will have a `statusCode` and `message`. But `data` attribute is not returned in the response unless it is
   * an error response in that case   `data` will have `error` attribute.
   *
   * @param messageId - The identifier of the voicemail message to delete.
   * @example
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.deleteVoicemail(messageId);
   * ```
   * The `voicemailResponse` object will be populated as below:
   *
   * ```json
   * {
   *    statusCode: 200,
   *    message: "SUCCESS"
   * }
   * ```
   */
  deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent>;

  /**
   * Retrieves the transcript of a voicemail message based on its message identifier.
   * Received data can be accessed through `data.voicemailTranscript`
   *
   * @param messageId - The identifier of the voicemail message.
   *
   * @example
   * ```typescript
   * const messageId = 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvNTc3OTQ2NjItNDA5OS00NDQ3LWI';
   * const voicemailResponse = await voicemailInstance.getVMTranscript(messageId);
   * ```
   * The `voicemailResponse` object will have `voicemailTranscript` object as properties in data attribute.
   *
   * ```json
   * {
   *    statusCode: 200,
   *    data: {
   *        voicemailTranscript: 'Here is your transcript.'
   *    }
   * }
   * ```
   */
  getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null>;

  /**
   * Resolves contact information based on calling party information.
   *
   * @param callingPartyInfo - The calling party information for contact resolution.
   *
   * @example
   * ```typescript
   * const callingPartyInfo = { userId: "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wZmVh" };
   * const contactInfo = await voicemailInstance.resolveContact(callingPartyInfo);
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
