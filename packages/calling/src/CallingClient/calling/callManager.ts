/* eslint-disable dot-notation */
/* eslint-disable valid-jsdoc */
import {CALL_MANAGER_FILE} from '../constants';
import {CALLING_CLIENT_EVENT_KEYS, CallEventTypes, LINE_EVENT_KEYS} from '../../Events/types';
import {Eventing} from '../../Events/impl';
import SDKConnector from '../../SDKConnector';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {CallDetails, CallDirection, CorrelationId, ServiceIndicator} from '../../common/types';
import {
  ICall,
  ICallManager,
  MediaState,
  MidCallEvent,
  MobiusCallEvent,
  MobiusEventType,
} from './types';
import {createCall} from './call';
import log from '../../Logger';
import {ILine} from '../line/types';

let callManager: ICallManager;

/**
 *
 */
export class CallManager extends Eventing<CallEventTypes> implements ICallManager {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private callCollection: Record<CorrelationId, ICall>;

  private activeMobiusUrl!: string;

  private serviceIndicator: ServiceIndicator;

  private lineDict: Record<string, ILine>;

  /**
   * @param webex -.
   * @param indicator - Service Indicator.
   */
  constructor(webex: WebexSDK, indicator: ServiceIndicator) {
    super();
    this.sdkConnector = SDKConnector;
    this.serviceIndicator = indicator;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.lineDict = {};
    this.webex = this.sdkConnector.getWebex();
    this.callCollection = {};
    this.activeMobiusUrl = '';
    this.listenForWsEvents();
  }

  /**
   * @param direction -.
   * @param deviceId -.
   * @param destination -.
   */
  public createCall = (
    direction: CallDirection,
    deviceId: string,
    lineId: string,
    destination?: CallDetails
  ): ICall => {
    log.log('Creating call object', {});
    const newCall = createCall(
      this.activeMobiusUrl,
      this.webex,
      direction,
      deviceId,
      lineId,
      (correlationId: CorrelationId) => {
        delete this.callCollection[correlationId];
        const activeCalls = Object.keys(this.getActiveCalls()).length;

        log.info(
          `DELETE:: Deleted corelationId: ${newCall.getCorrelationId()} from CallManager, Number of call records :- ${activeCalls}`,
          {}
        );
        if (activeCalls === 0) {
          /* Notify CallingClient when all calls are cleared. */
          this.emit(CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED);
        }
      },
      this.serviceIndicator,
      destination
    );

    this.callCollection[newCall.getCorrelationId()] = newCall;
    log.log(`New call created with correlationId: ${newCall.getCorrelationId()}`, {});
    log.info(
      `ADD:: Added corelationId: ${newCall.getCorrelationId()} to CallManager , Number of call records now:- ${
        Object.keys(this.getActiveCalls()).length
      }`,
      {}
    );

    return newCall;
  };

  /**
   * Update Active Mobius Url.
   *
   * @param url - Mobius Url.
   */
  public updateActiveMobius(url: string) {
    this.activeMobiusUrl = url;
  }

  /**
   * A listener for Mobius events.
   */
  private listenForWsEvents() {
    this.sdkConnector.registerListener('event:mobius', async (event) => {
      this.dequeueWsEvents(event);
    });
  }

  /**
   * This a Queue where Mobius Events are reported by the underlying Mercury
   * Connection. We handle the events in the order they are posted here. New call
   * Objects are generated from here.
   *
   * @param event - Mobius Events.
   */
  private dequeueWsEvents(event: unknown) {
    const mobiusEvent = event as MobiusCallEvent;
    const {callId, correlationId} = mobiusEvent.data;

    switch (mobiusEvent.data.eventType) {
      case MobiusEventType.CALL_SETUP: {
        log.log(`Received call Setup message for call: ${callId}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });
        /* Check whether MidCall or not */
        if (mobiusEvent.data.midCallService) {
          mobiusEvent.data.midCallService.forEach((midCallEvent: MidCallEvent) => {
            const call = this.getCall(correlationId);

            if (call) {
              call.handleMidCallEvent(midCallEvent);
            } else {
              log.log(
                `Dropping midcall event of type: ${midCallEvent.eventType} as it doesn't match with any existing call`,
                {
                  file: CALL_MANAGER_FILE,
                  method: 'dequeueWsEvents',
                }
              );
            }
          });

          return;
        }
        /* Check if the Call.Media was processed before Call.Setup.
         * In that case , the Call Object is already created while processing
         * Media message.
         */

        const newId = (Object.keys(this.callCollection) as Array<string>).find(
          (id) => this.callCollection[id].getCallId() === callId
        );
        let newCall: ICall;

        if (!newId) {
          /*  This means it's a new call ...
           *  Create an incoming call object and add to our records
           */
          const lineId = this.getLineId(mobiusEvent.data.deviceId);
          newCall = this.createCall(
            CallDirection.INBOUND,
            mobiusEvent.data.deviceId,
            lineId,
            {} as CallDetails
          );
          log.log(
            `New incoming call created with correlationId from Call Setup message: ${newCall.getCorrelationId()}`,
            {
              file: CALL_MANAGER_FILE,
              method: 'dequeueWsEvents',
            }
          );
          newCall.setCallId(callId);
          if (mobiusEvent.data.broadworksCorrelationInfo) {
            log.log(
              `Found broadworksCorrelationInfo: ${mobiusEvent.data.broadworksCorrelationInfo}`,
              {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              }
            );
            newCall.setBroadworksCorrelationInfo(mobiusEvent.data.broadworksCorrelationInfo);
          }
        } else {
          log.info(
            `Found the call Object with a matching callId: ${callId} from our records with correlationId: ${newId}`,
            {
              file: CALL_MANAGER_FILE,
              method: 'dequeueWsEvents',
            }
          );
          newCall = this.getCall(newId);
        }

        if (mobiusEvent.data.callerId) {
          log.info('Processing Caller-Id data', {
            file: CALL_MANAGER_FILE,
            method: 'dequeueWsEvents',
          });
          newCall.startCallerIdResolution(mobiusEvent.data.callerId);
        }
        /* Signal Line */

        this.emit(LINE_EVENT_KEYS.INCOMING_CALL, newCall);

        newCall.sendCallStateMachineEvt({type: 'E_RECV_CALL_SETUP', data: mobiusEvent.data});

        break;
      }
      case MobiusEventType.CALL_PROGRESS: {
        log.log(`Received call progress mobiusEvent for call: ${correlationId}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });
        const call = this.getCall(correlationId);

        call.sendCallStateMachineEvt({type: 'E_RECV_CALL_PROGRESS', data: mobiusEvent.data});
        break;
      }
      case MobiusEventType.CALL_MEDIA: {
        log.log(`Received call media mobiusEvent for call: ${correlationId}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });

        let activeCall: ICall;

        if (correlationId) {
          /* The Call.Media message had correlation id (Except the first message) */
          activeCall = this.getCall(correlationId);
        } else {
          /* This is possibly the first Media message for the call.
           * We should scan our record to see if we can find a call with
           * this callId.
           */

          const newId = (Object.keys(this.callCollection) as Array<string>).find(
            (id) => this.callCollection[id].getCallId() === callId
          );

          if (newId) {
            /* Call.Media arrived after Call.Setup but the correlationId was Null. */

            log.info(
              `Found the call Object with a matching callId: ${callId} from our records with correlationId: ${newId}`,
              {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              }
            );
            activeCall = this.getCall(newId);
          } else {
            /* If Call.Media arrived before Call.Setup , we create the Call Object here */

            const lineId = this.getLineId(mobiusEvent.data.deviceId);
            activeCall = this.createCall(
              CallDirection.INBOUND,
              mobiusEvent.data.deviceId,
              lineId,
              {} as CallDetails
            );
            log.log(
              `New incoming call created with correlationId from ROAP Message: ${activeCall.getCorrelationId()}`,
              {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              }
            );
            activeCall.setCallId(callId);
          }
        }

        if (activeCall) {
          /* Only Handle if the call is present */

          log.info(`SDP from mobius ${mobiusEvent.data.message?.sdp}`, {
            file: CALL_MANAGER_FILE,
            method: 'dequeueWsEvents',
          });
          log.log(
            `ROAP message from mobius with type:  ${mobiusEvent.data.message?.messageType}, seq: ${mobiusEvent.data.message?.seq} , version: ${mobiusEvent.data.message?.version}`,
            {
              file: CALL_MANAGER_FILE,
              method: 'dequeueWsEvents',
            }
          );
          const mediaState = mobiusEvent.data.message?.messageType;

          switch (mediaState) {
            case MediaState.OFFER: {
              log.log('Received OFFER', {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
              activeCall.sendMediaStateMachineEvt({
                type: 'E_RECV_ROAP_OFFER',
                data: mobiusEvent.data.message,
              });
              break;
            }
            case MediaState.ANSWER: {
              log.log('Received ANSWER', {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
              activeCall.sendMediaStateMachineEvt({
                type: 'E_RECV_ROAP_ANSWER',
                data: mobiusEvent.data.message,
              });
              break;
            }
            case MediaState.OFFER_REQUEST: {
              log.log('Received OFFER_REQUEST', {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
              activeCall.sendMediaStateMachineEvt({
                type: 'E_RECV_ROAP_OFFER_REQUEST',
                data: mobiusEvent.data.message,
              });
              break;
            }
            case MediaState.OK: {
              log.log('Received OK', {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
              const mediaOk = {
                received: true,
                message: mobiusEvent.data.message,
              };

              activeCall.sendMediaStateMachineEvt({
                type: 'E_ROAP_OK',
                data: mediaOk,
              });
              break;
            }
            case MediaState.ERROR: {
              log.log('Received Error...', {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
              break;
            }
            default: {
              log.log(`Unknown Media mobiusEvent: ${mediaState} `, {
                file: CALL_MANAGER_FILE,
                method: 'dequeueWsEvents',
              });
            }
          }
        } else {
          log.log(`CorrelationId: ${correlationId} doesn't exist , discarding..`, {
            file: CALL_MANAGER_FILE,
            method: 'dequeueWsEvents',
          });
          // TODO: Maybe add a queue  for these mobiusEvents per callID and handle them once the call is setup ?
        }
        break;
      }
      case MobiusEventType.CALL_CONNECTED: {
        log.log(`Received call connect for call: ${correlationId}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });
        const call = this.getCall(correlationId);

        call.sendCallStateMachineEvt({type: 'E_RECV_CALL_CONNECT', data: mobiusEvent.data});

        break;
      }
      case MobiusEventType.CALL_DISCONNECTED: {
        log.log(`Received call disconnect for call: ${correlationId}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });
        const call = this.getCall(correlationId);

        if (call) {
          call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});
        }
        break;
      }
      default: {
        log.log(`Unknown Call Event mobiusEvent: ${mobiusEvent.data.eventType}`, {
          file: CALL_MANAGER_FILE,
          method: 'dequeueWsEvents',
        });
      }
    }
  }

  /**
   * @param correlationId -.
   */
  public getCall = (correlationId: CorrelationId): ICall => {
    return this.callCollection[correlationId];
  };

  /**
   *
   */
  public getActiveCalls = (): Record<string, ICall> => {
    return this.callCollection;
  };

  /**
   * Adds line instance to lineDict
   */
  public updateLine(deviceId: string, line: ILine) {
    this.lineDict[deviceId] = line;
  }

  /**
   * Retrieves line id
   */
  private getLineId(deviceId: string) {
    return this.lineDict[deviceId].lineId;
  }
}

/**
 * @param webex -.
 * @param indicator - Service Indicator.
 */
export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => {
  if (!callManager) {
    callManager = new CallManager(webex, indicator);
  }

  return callManager;
};
