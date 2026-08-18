import LoggerProxy from '../logger-proxy';
import {CC_FILE, METHODS} from '../constants';
import {HTTP_METHODS, IHttpResponse, WebexSDK} from '../types';
import {getErrorDetails} from './core/Utils';

const ANSWER_CALL_ON_WEBEX_FILE = 'AnswerCallOnWebexService';

export type WxAppTelephonyError = Error & {
  isWxAppTelephonyError: true;
  trackingId?: string;
  status?: number | string;
};

const markWxAppTelephonyError = (error: Error, source: unknown): WxAppTelephonyError => {
  const marked = error as WxAppTelephonyError;
  marked.isWxAppTelephonyError = true;
  const sourceObj = source as {
    details?: {trackingId?: string; status?: number | string};
    statusCode?: number;
    status?: number | string;
  };
  const trackingId = sourceObj?.details?.trackingId;
  if (trackingId) {
    marked.trackingId = trackingId;
  }
  const status = sourceObj?.statusCode ?? sourceObj?.details?.status ?? sourceObj?.status;
  if (status !== undefined) {
    marked.status = status;
  }

  return marked;
};

export type AnswerCallParams = {
  callId: string;
  endpointId: string;
  lineOwnerId?: string;
};

export type CallIdParams = {
  callId: string;
  lineOwnerId?: string;
};

export type TransmitDtmfParams = CallIdParams & {
  dtmf: string;
};

export type CallDetailsResponse = {
  muted?: boolean;
};

/**
 * REST telephony client for wxApp thick-client answer (WXCC-6026).
 * Separate from WebCallingService (WebRTC/Mobius).
 */
export default class AnswerCallOnWebexService {
  private webex: WebexSDK;

  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  private getTelephonyBaseUrl(): string {
    const services = this.webex.internal.services;
    const hydraUrl = services._serviceUrls?.hydra || services.get('hydra');

    if (!hydraUrl) {
      throw new Error('Telephony base URL is unavailable');
    }

    return `${hydraUrl.replace(/\/$/, '')}/telephony/calls`;
  }

  private async telephonyRequest(
    resource: string,
    method: HTTP_METHODS,
    body: Record<string, unknown>,
    logMethod: string
  ): Promise<IHttpResponse> {
    try {
      const uri = `${this.getTelephonyBaseUrl()}${resource}`;

      LoggerProxy.info(`AnswerCallOnWebexService.${logMethod} request`, {
        module: ANSWER_CALL_ON_WEBEX_FILE,
        method: logMethod,
        data: {uri, bodyKeys: Object.keys(body)},
      });

      return (await this.webex.request({
        uri,
        method,
        body,
        addAuthHeader: true,
      })) as IHttpResponse;
    } catch (error) {
      LoggerProxy.error(`AnswerCallOnWebexService.${logMethod} failed: ${error}`, {
        module: ANSWER_CALL_ON_WEBEX_FILE,
        method: logMethod,
      });
      const {error: detailedError} = getErrorDetails(error, logMethod, CC_FILE);
      throw markWxAppTelephonyError(detailedError, error);
    }
  }

  public answerCall(params: AnswerCallParams): Promise<IHttpResponse> {
    const {callId, endpointId, lineOwnerId} = params;

    return this.telephonyRequest(
      '/answer',
      HTTP_METHODS.POST,
      {
        callId,
        endpointId,
        ...(lineOwnerId ? {lineOwnerId} : {}),
      },
      METHODS.ACCEPT_ON_WEBEX
    );
  }

  public rejectCall(params: CallIdParams): Promise<IHttpResponse> {
    const {callId, lineOwnerId} = params;

    return this.telephonyRequest(
      '/reject',
      HTTP_METHODS.POST,
      {callId, ...(lineOwnerId ? {lineOwnerId} : {})},
      METHODS.REJECT_ON_WEBEX
    );
  }

  public muteCall(params: CallIdParams): Promise<IHttpResponse> {
    const {callId, lineOwnerId} = params;

    return this.telephonyRequest(
      '/mute',
      HTTP_METHODS.POST,
      {callId, ...(lineOwnerId ? {lineOwnerId} : {})},
      METHODS.TOGGLE_MUTE_ON_WEBEX
    );
  }

  public unmuteCall(params: CallIdParams): Promise<IHttpResponse> {
    const {callId, lineOwnerId} = params;

    return this.telephonyRequest(
      '/unmute',
      HTTP_METHODS.POST,
      {callId, ...(lineOwnerId ? {lineOwnerId} : {})},
      METHODS.TOGGLE_MUTE_ON_WEBEX
    );
  }

  public transmitDtmf(params: TransmitDtmfParams): Promise<IHttpResponse> {
    const {callId, dtmf, lineOwnerId} = params;

    return this.telephonyRequest(
      '/transmitDtmf',
      HTTP_METHODS.POST,
      {callId, dtmf, ...(lineOwnerId ? {lineOwnerId} : {})},
      METHODS.TRANSMIT_DTMF_ON_WEBEX
    );
  }

  public async getCallDetails(params: CallIdParams): Promise<CallDetailsResponse> {
    const {callId, lineOwnerId} = params;
    const lineOwnerIdQuery = lineOwnerId ? `?lineOwnerId=${encodeURIComponent(lineOwnerId)}` : '';
    const uri = `${this.getTelephonyBaseUrl()}/${callId}${lineOwnerIdQuery}`;

    try {
      LoggerProxy.info('AnswerCallOnWebexService.getCallDetails request', {
        module: ANSWER_CALL_ON_WEBEX_FILE,
        method: METHODS.GET_CALL_DETAILS_ON_WEBEX,
        data: {callId},
      });

      const response = (await this.webex.request({
        uri,
        method: HTTP_METHODS.GET,
        addAuthHeader: true,
      })) as IHttpResponse;

      return (response.body ?? {}) as CallDetailsResponse;
    } catch (error) {
      LoggerProxy.error(`AnswerCallOnWebexService.getCallDetails failed: ${error}`, {
        module: ANSWER_CALL_ON_WEBEX_FILE,
        method: METHODS.GET_CALL_DETAILS_ON_WEBEX,
      });
      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.GET_CALL_DETAILS_ON_WEBEX,
        CC_FILE
      );
      throw markWxAppTelephonyError(detailedError, error);
    }
  }
}
