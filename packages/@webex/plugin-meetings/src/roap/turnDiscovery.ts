// @ts-ignore - Types not available for @webex/common
import {Defer} from '@webex/common';

import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';
import LoggerProxy from '../common/logs/logger-proxy';
import {ROAP, Enum} from '../constants';

import RoapRequest from './request';
import Meeting from '../meeting';
import MeetingUtil from '../meeting/util';

const TURN_DISCOVERY_TIMEOUT = 10; // in seconds

// Roap spec says that seq should start from 1, but TURN discovery works fine with seq=0
// and this is handy for us, because TURN discovery is always done before the first SDP exchange,
// so we can do it with seq=0 or not do it at all and then we create the RoapMediaConnection
// and do the SDP offer with seq=1
const TURN_DISCOVERY_SEQ = 0;

const TurnDiscoverySkipReason = {
  missingHttpResponse: 'missing http response', // when we asked for the TURN discovery response to be in the http response, but it wasn't there
  reachability: 'reachability', // when udp reachability to public clusters is ok, so we don't need TURN (this doens't apply when joinWithMedia() is used)
  alreadyInProgress: 'already in progress', // when we try to start TURN discovery while it's already in progress
} as const;

export type TurnDiscoverySkipReason =
  | Enum<typeof TurnDiscoverySkipReason> // this is a kind of FYI, because in practice typescript will infer the type of TurnDiscoverySkipReason as a string
  | string // used in case of errors, contains the error message
  | undefined; // used when TURN discovery is not skipped

export type TurnServerInfo = {
  url: string;
  username: string;
  password: string;
};

export type TurnDiscoveryResult = {
  turnServerInfo?: TurnServerInfo;
  turnDiscoverySkippedReason: TurnDiscoverySkipReason;
};

/**
 * Handles the process of finding out TURN server information from Linus.
 * This is achieved by sending a TURN_DISCOVERY_REQUEST.
 */
export default class TurnDiscovery {
  private roapRequest: RoapRequest;

  private defer?: Defer; // used for waiting for the response

  private turnInfo: TurnServerInfo;

  private responseTimer?: ReturnType<typeof setTimeout>;

  /**
   * Constructor
   *
   * @param {RoapRequest} roapRequest
   */
  constructor(roapRequest: RoapRequest) {
    this.roapRequest = roapRequest;
    this.turnInfo = {
      url: '',
      username: '',
      password: '',
    };
  }

  /**
   * waits for TURN_DISCOVERY_RESPONSE message to arrive
   *
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  private waitForTurnDiscoveryResponse(): Promise<{isOkRequired: boolean}> {
    if (!this.defer) {
      LoggerProxy.logger.warn(
        'Roap:turnDiscovery#waitForTurnDiscoveryResponse --> TURN discovery is not in progress'
      );

      return Promise.reject(
        new Error('waitForTurnDiscoveryResponse() called before sendRoapTurnDiscoveryRequest()')
      );
    }

    const {defer} = this;

    this.responseTimer = setTimeout(() => {
      LoggerProxy.logger.warn(
        `Roap:turnDiscovery#waitForTurnDiscoveryResponse --> timeout! no response arrived within ${TURN_DISCOVERY_TIMEOUT} seconds`
      );

      defer.reject(new Error('Timed out waiting for TURN_DISCOVERY_RESPONSE'));
    }, TURN_DISCOVERY_TIMEOUT * 1000);

    LoggerProxy.logger.info(
      'Roap:turnDiscovery#waitForTurnDiscoveryResponse --> waiting for TURN_DISCOVERY_RESPONSE...'
    );

    return defer.promise;
  }

  /**
   * Handles TURN_DISCOVERY_RESPONSE roap message. Use it if the roap message comes over the websocket,
   * otherwise use handleTurnDiscoveryHttpResponse() if it comes in the http response.
   *
   * @param {Object} roapMessage
   * @param {string} from string to indicate how we got the response (used just for logging)
   * @returns {void}
   * @public
   * @memberof Roap
   */
  public handleTurnDiscoveryResponse(roapMessage: any, from: string) {
    const {headers} = roapMessage;

    if (!this.defer) {
      LoggerProxy.logger.warn(
        `Roap:turnDiscovery#handleTurnDiscoveryResponse --> unexpected TURN discovery response ${from}`
      );

      return;
    }

    if (roapMessage.messageType !== ROAP.ROAP_TYPES.TURN_DISCOVERY_RESPONSE) {
      this.defer.reject(
        new Error(
          `TURN_DISCOVERY_RESPONSE ${from} has unexpected messageType: ${JSON.stringify(
            roapMessage
          )}`
        )
      );
    }

    const expectedHeaders = [
      {headerName: 'x-cisco-turn-url', field: 'url'},
      {headerName: 'x-cisco-turn-username', field: 'username'},
      {headerName: 'x-cisco-turn-password', field: 'password'},
    ];

    let foundHeaders = 0;

    headers?.forEach((receivedHeader) => {
      // check if it matches any of our expected headers
      expectedHeaders.forEach((expectedHeader) => {
        if (receivedHeader.startsWith(`${expectedHeader.headerName}=`)) {
          this.turnInfo[expectedHeader.field] = receivedHeader.substring(
            expectedHeader.headerName.length + 1
          );
          foundHeaders += 1;
        }
      });
    });

    clearTimeout(this.responseTimer);
    this.responseTimer = undefined;

    if (foundHeaders !== expectedHeaders.length) {
      LoggerProxy.logger.warn(
        `Roap:turnDiscovery#handleTurnDiscoveryResponse --> missing some headers, received ${from}: ${JSON.stringify(
          headers
        )}`
      );
      this.defer.reject(
        new Error(
          `TURN_DISCOVERY_RESPONSE ${from} missing some headers: ${JSON.stringify(headers)}`
        )
      );
    } else {
      LoggerProxy.logger.info(
        `Roap:turnDiscovery#handleTurnDiscoveryResponse --> received a valid response ${from}, url=${this.turnInfo.url}`
      );

      this.defer.resolve({isOkRequired: !headers?.includes('noOkInTransaction')});
    }
  }

  /**
   * Generates TURN_DISCOVERY_REQUEST roap message. When this method returns a roapMessage, it means that a TURN discovery process has started.
   * It needs be ended by calling handleTurnDiscoveryHttpResponse() once you get a response from the backend. If you don't get any response
   * or want to abort, you need to call abort().
   *
   * @param {Meeting} meeting
   * @param {boolean} isForced
   * @returns {Object}
   */
  public async generateTurnDiscoveryRequestMessage(
    meeting: Meeting,
    isForced: boolean
  ): Promise<{roapMessage?: object; turnDiscoverySkippedReason: TurnDiscoverySkipReason}> {
    if (this.defer) {
      LoggerProxy.logger.warn(
        'Roap:turnDiscovery#generateTurnDiscoveryRequestMessage --> TURN discovery already in progress'
      );

      return {
        roapMessage: undefined,
        turnDiscoverySkippedReason: TurnDiscoverySkipReason.alreadyInProgress,
      };
    }

    let turnDiscoverySkippedReason: TurnDiscoverySkipReason;

    if (!isForced) {
      turnDiscoverySkippedReason = await this.getSkipReason(meeting);
    }

    if (turnDiscoverySkippedReason) {
      return {roapMessage: undefined, turnDiscoverySkippedReason};
    }

    this.defer = new Defer();

    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.TURN_DISCOVERY_REQUEST,
      version: ROAP.ROAP_VERSION,
      seq: TURN_DISCOVERY_SEQ,
      headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
    };

    LoggerProxy.logger.info(
      'Roap:turnDiscovery#generateTurnDiscoveryRequestMessage --> generated TURN_DISCOVERY_REQUEST message'
    );

    return {roapMessage, turnDiscoverySkippedReason: undefined};
  }

  /**
   * Handles any errors that occur during TURN discovery without re-throwing them.
   *
   * @param {Meeting} meeting
   * @param {Error} error
   * @returns {TurnDiscoveryResult}
   */
  private handleTurnDiscoveryFailure(meeting: Meeting, error: Error): TurnDiscoveryResult {
    // we catch any errors and resolve with no turn information so that the normal call join flow can continue without TURN
    LoggerProxy.logger.info(
      `Roap:turnDiscovery#doTurnDiscovery --> TURN discovery failed, continuing without TURN: ${error}`
    );

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.TURN_DISCOVERY_FAILURE, {
      correlation_id: meeting.correlationId,
      locus_id: meeting.locusUrl.split('/').pop(),
      reason: error.message,
      stack: error.stack,
    });

    return {turnServerInfo: undefined, turnDiscoverySkippedReason: `failure: ${error.message}`};
  }

  /**
   * Handles TURN_DISCOVERY_RESPONSE roap message that came in http response. If the response is not valid,
   * it returns an object with turnServerInfo set to undefined. In that case you need to call abort()
   * to end the TURN discovery process.
   *
   * @param {Meeting} meeting
   * @param {Object|undefined} httpResponse can be undefined to indicate that we didn't get the response
   * @returns {Promise<TurnDiscoveryResult>}
   * @memberof Roap
   */
  public async handleTurnDiscoveryHttpResponse(
    meeting: Meeting,
    httpResponse?: object
  ): Promise<TurnDiscoveryResult> {
    if (!this.defer) {
      LoggerProxy.logger.warn(
        'Roap:turnDiscovery#handleTurnDiscoveryHttpResponse --> unexpected http response, TURN discovery is not in progress'
      );

      throw new Error(
        'handleTurnDiscoveryHttpResponse() called before generateTurnDiscoveryRequestMessage()'
      );
    }

    if (httpResponse === undefined) {
      return {
        turnServerInfo: undefined,
        turnDiscoverySkippedReason: TurnDiscoverySkipReason.missingHttpResponse,
      };
    }

    try {
      const roapMessage = this.parseHttpTurnDiscoveryResponse(meeting, httpResponse);

      if (!roapMessage) {
        return {
          turnServerInfo: undefined,
          turnDiscoverySkippedReason: TurnDiscoverySkipReason.missingHttpResponse,
        };
      }

      this.handleTurnDiscoveryResponse(roapMessage, 'in http response');

      const {isOkRequired} = await this.defer.promise;

      if (isOkRequired) {
        await this.sendRoapOK(meeting);
      }

      this.defer = undefined;

      LoggerProxy.logger.info('Roap:turnDiscovery#doTurnDiscovery --> TURN discovery completed');

      return {turnServerInfo: this.turnInfo, turnDiscoverySkippedReason: undefined};
    } catch (error) {
      this.abort();

      return this.handleTurnDiscoveryFailure(meeting, error);
    }
  }

  /**
   * Aborts current TURN discovery. This method needs to be called if you called generateTurnDiscoveryRequestMessage(),
   * but then never got any response from the server.
   * @returns {void}
   */
  public abort() {
    if (this.defer) {
      this.defer.reject(new Error('TURN discovery aborted'));
      this.defer = undefined;
    }
  }

  /**
   * Parses the TURN_DISCOVERY_RESPONSE roap message out of the http response
   * and returns it.
   *
   * @param {Meeting} meeting
   * @param {any} httpResponse
   * @returns {any}
   */
  private parseHttpTurnDiscoveryResponse(
    meeting: Meeting,
    httpResponse: {mediaConnections?: Array<{remoteSdp?: string}>}
  ) {
    let turnDiscoveryResponse;

    if (httpResponse.mediaConnections?.[0]?.remoteSdp) {
      const remoteSdp = JSON.parse(httpResponse.mediaConnections[0].remoteSdp);

      if (remoteSdp.roapMessage) {
        // yes, it's misleading that remoteSdp actually contains a TURN discovery response, but that's how the backend works...
        const {seq, messageType, errorType, errorCause, headers} = remoteSdp.roapMessage;

        turnDiscoveryResponse = {
          seq,
          messageType,
          errorType,
          errorCause,
          headers,
        };
      }
    }

    if (!turnDiscoveryResponse) {
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ROAP_HTTP_RESPONSE_MISSING, {
        correlationId: meeting.correlationId,
        messageType: 'TURN_DISCOVERY_RESPONSE',
        isMultistream: meeting.isMultistream,
      });
    }

    return turnDiscoveryResponse;
  }

  /**
   * sends the TURN_DISCOVERY_REQUEST roap request
   *
   * @param {Meeting} meeting
   * @param {Boolean} isReconnecting
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  private sendRoapTurnDiscoveryRequest(
    meeting: Meeting,
    isReconnecting: boolean
  ): Promise<TurnDiscoveryResult> {
    console.log('marcin: sendRoapTurnDiscoveryRequest');
    if (this.defer) {
      LoggerProxy.logger.warn(
        'Roap:turnDiscovery#sendRoapTurnDiscoveryRequest --> already in progress'
      );

      return Promise.resolve({
        turnServerInfo: undefined,
        turnDiscoverySkippedReason: TurnDiscoverySkipReason.alreadyInProgress,
      });
    }

    this.defer = new Defer();

    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.TURN_DISCOVERY_REQUEST,
      version: ROAP.ROAP_VERSION,
      seq: TURN_DISCOVERY_SEQ,
      headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
    };

    LoggerProxy.logger.info(
      'Roap:turnDiscovery#sendRoapTurnDiscoveryRequest --> sending TURN_DISCOVERY_REQUEST'
    );

    return this.roapRequest
      .sendRoap({
        roapMessage,
        // @ts-ignore - Fix missing type
        locusSelfUrl: meeting.selfUrl,
        // @ts-ignore - Fix missing type
        mediaId: isReconnecting ? '' : meeting.mediaId,
        meetingId: meeting.id,
        locusMediaRequest: meeting.locusMediaRequest,
        // @ts-ignore - because of meeting.webex
        ipVersion: MeetingUtil.getIpVersion(meeting.webex),
      })
      .then(async (response) => {
        const {mediaConnections} = response;

        if (mediaConnections) {
          meeting.updateMediaConnections(mediaConnections);
        }

        return this.handleTurnDiscoveryHttpResponse(meeting, response);
      });
  }

  /**
   * Sends the OK message that server expects to receive
   * after it sends us TURN_DISCOVERY_RESPONSE
   *
   * @param {Meeting} meeting
   * @returns {Promise}
   */
  sendRoapOK(meeting: Meeting) {
    LoggerProxy.logger.info(
      'Roap:turnDiscovery#sendRoapOK --> TURN discovery response requires OK, sending it...'
    );

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.TURN_DISCOVERY_REQUIRES_OK, {
      correlation_id: meeting.correlationId,
      locus_id: meeting.locusUrl.split('/').pop(),
    });

    return this.roapRequest.sendRoap({
      roapMessage: {
        messageType: ROAP.ROAP_TYPES.OK,
        version: ROAP.ROAP_VERSION,
        seq: TURN_DISCOVERY_SEQ,
      },
      // @ts-ignore - fix type
      locusSelfUrl: meeting.selfUrl,
      // @ts-ignore - fix type
      mediaId: meeting.mediaId,
      meetingId: meeting.id,
      locusMediaRequest: meeting.locusMediaRequest,
    });
  }

  /**
   * Gets the reason why reachability is skipped.
   *
   * @param {Meeting} meeting
   * @returns {Promise<string>} Promise with empty string if reachability is not skipped or a reason if it is skipped
   */
  private async getSkipReason(meeting: Meeting): Promise<TurnDiscoverySkipReason> {
    const isAnyPublicClusterReachable =
      // @ts-ignore - fix type
      await meeting.webex.meetings.reachability.isAnyPublicClusterReachable();

    if (isAnyPublicClusterReachable) {
      LoggerProxy.logger.info(
        'Roap:turnDiscovery#getSkipReason --> reachability has not failed, skipping TURN discovery'
      );

      return TurnDiscoverySkipReason.reachability;
    }

    return undefined;
  }

  /**
   * Checks if TURN discovery is skipped.
   *
   * @param {Meeting} meeting
   * @returns {Boolean} true if TURN discovery is being skipped, false if it is being done
   */
  async isSkipped(meeting) {
    const skipReason = await this.getSkipReason(meeting);

    return !!skipReason;
  }

  /**
   * Retrieves TURN server information from the backend by doing
   * a roap message exchange:
   * client                             server
   *  | -----TURN_DISCOVERY_REQUEST-----> |
   *  | <----TURN_DISCOVERY_RESPONSE----- |
   *  | --------------OK----------------> |
   *
   * This TURN discovery roap exchange is always done with seq=0.
   * The RoapMediaConnection SDP exchange always starts with seq=1,
   * so it works fine no matter if TURN discovery is done or not.
   *
   * @param {Meeting} meeting
   * @param {Boolean} [isReconnecting] should be set to true if this is a new
   *                                 media connection just after a reconnection
   * @param {Boolean} [isForced]
   * @returns {Promise}
   */
  async doTurnDiscovery(
    meeting: Meeting,
    isReconnecting?: boolean,
    isForced?: boolean
  ): Promise<TurnDiscoveryResult> {
    let turnDiscoverySkippedReason: TurnDiscoverySkipReason;

    if (!isForced) {
      turnDiscoverySkippedReason = await this.getSkipReason(meeting);
    }

    if (turnDiscoverySkippedReason) {
      return {
        turnServerInfo: undefined,
        turnDiscoverySkippedReason,
      };
    }

    try {
      const turnDiscoveryResult = await this.sendRoapTurnDiscoveryRequest(meeting, isReconnecting);

      if (
        turnDiscoveryResult.turnDiscoverySkippedReason !==
        TurnDiscoverySkipReason.missingHttpResponse
      ) {
        return turnDiscoveryResult;
      }

      // if we haven't got the response over http, we need to wait for it to come over the websocket via Mercury
      const {isOkRequired} = await this.waitForTurnDiscoveryResponse();

      if (isOkRequired) {
        await this.sendRoapOK(meeting);
      }

      this.defer = undefined;

      LoggerProxy.logger.info('Roap:turnDiscovery#doTurnDiscovery --> TURN discovery completed');

      return {turnServerInfo: this.turnInfo, turnDiscoverySkippedReason: undefined};
    } catch (e) {
      return this.handleTurnDiscoveryFailure(meeting, e);
    }
  }
}
