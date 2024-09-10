import {
  MediaConnectionEventNames,
  LocalMicrophoneStream,
  LocalStreamEventNames,
  RoapMediaConnection,
} from '@webex/internal-media-core';
import {createMachine, interpret} from 'xstate';
import {v4 as uuid} from 'uuid';
import {EffectEvent, TrackEffect} from '@webex/web-media-effects';
import {ERROR_LAYER, ERROR_TYPE, ErrorContext} from '../../Errors/types';
import {handleCallErrors, parseMediaQualityStatistics} from '../../common/Utils';
import {
  ALLOWED_SERVICES,
  CallDetails,
  CallDirection,
  CallId,
  CorrelationId,
  DisplayInformation,
  HTTP_METHODS,
  ServiceIndicator,
  WebexRequestPayload,
} from '../../common/types';
import {CallError, createCallError} from '../../Errors/catalog/CallError';
/* eslint-disable tsdoc/syntax */
/* eslint-disable no-param-reassign */
import {
  CALL_ENDPOINT_RESOURCE,
  CALL_FILE,
  CALL_HOLD_SERVICE,
  CALL_STATUS_RESOURCE,
  CALL_TRANSFER_SERVICE,
  CALLING_USER_AGENT,
  CALLS_ENDPOINT_RESOURCE,
  CISCO_DEVICE_URL,
  DEFAULT_LOCAL_CALL_ID,
  DEFAULT_SESSION_TIMER,
  DEVICES_ENDPOINT_RESOURCE,
  HOLD_ENDPOINT,
  ICE_CANDIDATES_TIMEOUT,
  INITIAL_SEQ_NUMBER,
  MEDIA_ENDPOINT_RESOURCE,
  NOISE_REDUCTION_EFFECT,
  RESUME_ENDPOINT,
  SPARK_USER_AGENT,
  SUPPLEMENTARY_SERVICES_TIMEOUT,
  TRANSFER_ENDPOINT,
} from '../constants';
import SDKConnector from '../../SDKConnector';
import {Eventing} from '../../Events/impl';
import {
  CALL_EVENT_KEYS,
  CallerIdInfo,
  CallEvent,
  CallEventTypes,
  MEDIA_CONNECTION_EVENT_KEYS,
  MOBIUS_MIDCALL_STATE,
  RoapEvent,
  RoapMessage,
  SUPPLEMENTARY_SERVICES,
} from '../../Events/types';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {
  CallRtpStats,
  DeleteRecordCallBack,
  DisconnectCause,
  DisconnectCode,
  DisconnectReason,
  ICall,
  MediaContext,
  MidCallCallerId,
  MidCallEvent,
  MidCallEventType,
  MobiusCallData,
  MobiusCallResponse,
  MobiusCallState,
  PatchResponse,
  RoapScenario,
  SSResponse,
  SupplementaryServiceState,
  TransferContext,
  TransferType,
} from './types';
import log from '../../Logger';
import {ICallerId} from './CallerId/types';
import {createCallerId} from './CallerId';
import {IMetricManager, METRIC_TYPE, METRIC_EVENT, TRANSFER_ACTION} from '../../Metrics/types';
import {getMetricManager} from '../../Metrics';
import {SERVICES_ENDPOINT} from '../../common/constants';

/**
 *
 */
export class Call extends Eventing<CallEventTypes> implements ICall {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private destination: CallDetails;

  private direction: CallDirection;

  private callId: CallId;

  private correlationId: CorrelationId;

  private deviceId: string;

  public lineId: string;

  private disconnectReason: DisconnectReason;

  private callStateMachine;

  private mediaStateMachine;

  private seq: number; // TODO: remove later

  /* TODO: Need to change the type from any to RoapMediaConnection  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public mediaConnection?: any;

  private earlyMedia: boolean;

  private connected: boolean;

  private mediaInactivity: boolean;

  private callerInfo: DisplayInformation;

  private localRoapMessage: RoapMessage; // Use it for new offer

  private mobiusUrl!: string;

  private remoteRoapMessage: RoapMessage | null;

  private deleteCb: DeleteRecordCallBack;

  private callerId: ICallerId;

  private sessionTimer?: NodeJS.Timer;

  /* Used to wait for final responses for supplementary services */
  private supplementaryServicesTimer?: NodeJS.Timeout;

  private muted: boolean;

  private held: boolean;

  private metricManager: IMetricManager;

  private broadworksCorrelationInfo?: string; // Used in WxCC calls

  private serviceIndicator: ServiceIndicator;

  private mediaNegotiationCompleted: boolean;

  private receivedRoapOKSeq: number;

  private localAudioStream?: LocalMicrophoneStream;

  /**
   * Getter to check if the call is muted or not.
   *
   * @returns - Boolean.
   */
  public isMuted() {
    return this.muted;
  }

  /**
   * Getter to check if the call is connected or not.
   *
   * @returns - Boolean.
   */
  public isConnected() {
    return this.connected;
  }

  /**
   * Getter to check if the call is held or not.
   *
   * @returns - Boolean.
   */
  public isHeld() {
    return this.held;
  }

  /**
   * @ignore
   */
  constructor(
    activeUrl: string,
    webex: WebexSDK,
    destination: CallDetails,
    direction: CallDirection,
    deviceId: string,
    lineId: string,
    deleteCb: DeleteRecordCallBack,
    indicator: ServiceIndicator
  ) {
    super();
    this.destination = destination;
    this.direction = direction;
    this.sdkConnector = SDKConnector;
    this.deviceId = deviceId;
    this.serviceIndicator = indicator;
    this.lineId = lineId;

    /* istanbul ignore else */
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.metricManager = getMetricManager(this.webex, this.serviceIndicator);
    this.callId = `${DEFAULT_LOCAL_CALL_ID}_${uuid()}`;
    this.correlationId = uuid();
    this.deleteCb = deleteCb;
    this.connected = false;
    this.mediaInactivity = false;
    this.held = false;
    this.earlyMedia = false;
    this.callerInfo = {} as DisplayInformation;
    this.localRoapMessage = {} as RoapMessage;

    this.mobiusUrl = activeUrl;
    this.receivedRoapOKSeq = 0;
    this.mediaNegotiationCompleted = false;

    log.info(`Webex Calling Url:- ${this.mobiusUrl}`, {
      file: CALL_FILE,
      method: 'constructor',
    });

    this.seq = INITIAL_SEQ_NUMBER;
    this.callerId = createCallerId(webex, (callerInfo: DisplayInformation) => {
      this.callerInfo = callerInfo;
      const emitObj = {
        correlationId: this.correlationId,
        callerId: this.callerInfo,
      };

      this.emit(CALL_EVENT_KEYS.CALLER_ID, emitObj);
    });
    this.remoteRoapMessage = null;
    this.disconnectReason = {code: DisconnectCode.NORMAL, cause: DisconnectCause.NORMAL};

    const callMachine = createMachine(
      {
        schema: {
          context: {},
          // The events this machine handles
          events: {} as CallEvent,
        },
        id: 'call-state',
        initial: 'S_IDLE',
        context: {},
        states: {
          S_IDLE: {
            on: {
              E_RECV_CALL_SETUP: {
                target: 'S_RECV_CALL_SETUP',
                actions: ['incomingCallSetup'],
              },
              E_SEND_CALL_SETUP: {
                target: 'S_SEND_CALL_SETUP',
                actions: ['outgoingCallSetup'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },

          /* CALL SETUP */
          S_RECV_CALL_SETUP: {
            on: {
              E_SEND_CALL_ALERTING: {
                target: 'S_SEND_CALL_PROGRESS',
                actions: ['outgoingCallAlerting'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          S_SEND_CALL_SETUP: {
            on: {
              E_RECV_CALL_PROGRESS: {
                target: 'S_RECV_CALL_PROGRESS',
                actions: ['incomingCallProgress'],
              },
              E_RECV_CALL_CONNECT: {
                target: 'S_RECV_CALL_CONNECT',
                actions: ['incomingCallConnect'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },

          /* CALL_PROGRESS */
          S_RECV_CALL_PROGRESS: {
            on: {
              E_RECV_CALL_CONNECT: {
                target: 'S_RECV_CALL_CONNECT',
                actions: ['incomingCallConnect'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              // Possible to have multiple E_RECV_CALL_PROGRESS events, handler should handle it
              E_RECV_CALL_PROGRESS: {
                target: 'S_RECV_CALL_PROGRESS',
                actions: ['incomingCallProgress'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          S_SEND_CALL_PROGRESS: {
            on: {
              E_SEND_CALL_CONNECT: {
                target: 'S_SEND_CALL_CONNECT',
                actions: ['outgoingCallConnect'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },

          /* CALL_CONNECT */
          S_RECV_CALL_CONNECT: {
            on: {
              E_CALL_ESTABLISHED: {
                target: 'S_CALL_ESTABLISHED',
                actions: ['callEstablished'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          S_SEND_CALL_CONNECT: {
            on: {
              E_CALL_ESTABLISHED: {
                target: 'S_CALL_ESTABLISHED',
                actions: ['callEstablished'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          S_CALL_HOLD: {
            on: {
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_CALL_ESTABLISHED: {
                target: 'S_CALL_ESTABLISHED',
                actions: ['callEstablished'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          S_CALL_RESUME: {
            on: {
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_CALL_ESTABLISHED: {
                target: 'S_CALL_ESTABLISHED',
                actions: ['callEstablished'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },
          /* CALL_ESTABLISHED */
          S_CALL_ESTABLISHED: {
            on: {
              E_CALL_HOLD: {
                target: 'S_CALL_HOLD',
                actions: ['initiateCallHold'],
              },
              E_CALL_RESUME: {
                target: 'S_CALL_RESUME',
                actions: ['initiateCallResume'],
              },
              E_RECV_CALL_DISCONNECT: {
                target: 'S_RECV_CALL_DISCONNECT',
                actions: ['incomingCallDisconnect'],
              },
              E_SEND_CALL_DISCONNECT: {
                target: 'S_SEND_CALL_DISCONNECT',
                actions: ['outgoingCallDisconnect'],
              },
              E_CALL_ESTABLISHED: {
                target: 'S_CALL_ESTABLISHED',
                actions: ['callEstablished'],
              },
              E_UNKNOWN: {
                target: 'S_UNKNOWN',
                actions: ['unknownState'],
              },
            },
          },

          /* CALL_DISCONNECT */
          S_RECV_CALL_DISCONNECT: {
            on: {
              E_CALL_CLEARED: 'S_CALL_CLEARED',
            },
          },
          S_SEND_CALL_DISCONNECT: {
            on: {
              E_CALL_CLEARED: 'S_CALL_CLEARED',
            },
          },

          /* UNKNOWN_EVENTS */
          S_UNKNOWN: {
            on: {
              E_CALL_CLEARED: 'S_CALL_CLEARED',
            },
          },

          /* ERROR_EVENTS */
          S_ERROR: {
            on: {
              E_CALL_CLEARED: 'S_CALL_CLEARED',
            },
          },

          /* End of our state-machine */
          S_CALL_CLEARED: {
            type: 'final',
          },
        },
      },
      {
        actions: {
          /**
           * .
           *
           * @param context
           * @param event
           */
          incomingCallSetup: (context, event: CallEvent) => this.handleIncomingCallSetup(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          outgoingCallSetup: (context, event: CallEvent) => this.handleOutgoingCallSetup(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          incomingCallProgress: (context, event: CallEvent) =>
            this.handleIncomingCallProgress(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          outgoingCallAlerting: (context, event: CallEvent) =>
            this.handleOutgoingCallAlerting(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          incomingCallConnect: (context, event: CallEvent) => this.handleIncomingCallConnect(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          outgoingCallConnect: (context, event: CallEvent) => this.handleOutgoingCallConnect(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          callEstablished: (context, event: CallEvent) => this.handleCallEstablished(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          initiateCallHold: (context, event: CallEvent) => this.handleCallHold(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          initiateCallResume: (context, event: CallEvent) => this.handleCallResume(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          incomingCallDisconnect: (context, event: CallEvent) =>
            this.handleIncomingCallDisconnect(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          outgoingCallDisconnect: (context, event: CallEvent) =>
            this.handleOutgoingCallDisconnect(event),
          /**
           * .
           *
           * @param context
           * @param event
           */
          unknownState: (context, event: CallEvent) => this.handleUnknownState(event),
        },
      }
    );

    const mediaMachine = createMachine(
      {
        schema: {
          // The context (extended state) of the machine
          context: {},
          // The events this machine handles
          events: {} as RoapEvent,
        },
        id: 'roap-state',
        initial: 'S_ROAP_IDLE',
        context: {},
        states: {
          S_ROAP_IDLE: {
            on: {
              E_RECV_ROAP_OFFER_REQUEST: {
                target: 'S_RECV_ROAP_OFFER_REQUEST',
                actions: ['incomingRoapOfferRequest'],
              },
              E_RECV_ROAP_OFFER: {
                target: 'S_RECV_ROAP_OFFER',
                actions: ['incomingRoapOffer'],
              },
              E_SEND_ROAP_OFFER: {
                target: 'S_SEND_ROAP_OFFER',
                actions: ['outgoingRoapOffer'],
              },
            },
          },
          S_RECV_ROAP_OFFER_REQUEST: {
            on: {
              E_SEND_ROAP_OFFER: {
                target: 'S_SEND_ROAP_OFFER',
                actions: ['outgoingRoapOffer'],
              },
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
            },
          },
          S_RECV_ROAP_OFFER: {
            on: {
              E_SEND_ROAP_ANSWER: {
                target: 'S_SEND_ROAP_ANSWER',
                actions: ['outgoingRoapAnswer'],
              },
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
            },
          },
          S_SEND_ROAP_OFFER: {
            on: {
              E_RECV_ROAP_ANSWER: {
                target: 'S_RECV_ROAP_ANSWER',
                actions: ['incomingRoapAnswer'],
              },
              E_SEND_ROAP_ANSWER: {
                target: 'S_SEND_ROAP_ANSWER',
                actions: ['outgoingRoapAnswer'],
              },
              E_SEND_ROAP_OFFER: {
                target: 'S_SEND_ROAP_OFFER',
                actions: ['outgoingRoapOffer'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
            },
          },
          S_RECV_ROAP_ANSWER: {
            on: {
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
            },
          },
          S_SEND_ROAP_ANSWER: {
            on: {
              E_RECV_ROAP_OFFER_REQUEST: {
                target: 'S_RECV_ROAP_OFFER_REQUEST',
                actions: ['incomingRoapOfferRequest'],
              },
              E_RECV_ROAP_OFFER: {
                target: 'S_RECV_ROAP_OFFER',
                actions: ['incomingRoapOffer'],
              },
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
              E_SEND_ROAP_ANSWER: {
                target: 'S_SEND_ROAP_ANSWER',
                actions: ['outgoingRoapAnswer'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
            },
          },
          S_ROAP_OK: {
            on: {
              E_RECV_ROAP_OFFER_REQUEST: {
                target: 'S_RECV_ROAP_OFFER_REQUEST',
                actions: ['incomingRoapOfferRequest'],
              },
              E_RECV_ROAP_OFFER: {
                target: 'S_RECV_ROAP_OFFER',
                actions: ['incomingRoapOffer'],
              },
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
              E_SEND_ROAP_OFFER: {
                target: 'S_SEND_ROAP_OFFER',
                actions: ['outgoingRoapOffer'],
              },
              E_ROAP_ERROR: {
                target: 'S_ROAP_ERROR',
                actions: ['roapError'],
              },
              E_ROAP_TEARDOWN: {
                target: 'S_ROAP_TEARDOWN',
              },
            },
          },
          S_ROAP_ERROR: {
            on: {
              E_ROAP_TEARDOWN: {
                target: 'S_ROAP_TEARDOWN',
              },
              E_RECV_ROAP_OFFER_REQUEST: {
                target: 'S_RECV_ROAP_OFFER_REQUEST',
                actions: ['incomingRoapOfferRequest'],
              },
              E_RECV_ROAP_OFFER: {
                target: 'S_RECV_ROAP_OFFER',
                actions: ['incomingRoapOffer'],
              },
              E_RECV_ROAP_ANSWER: {
                target: 'S_RECV_ROAP_ANSWER',
                actions: ['incomingRoapAnswer'],
              },
              E_ROAP_OK: {
                target: 'S_ROAP_OK',
                actions: ['roapEstablished'],
              },
            },
          },
          S_ROAP_TEARDOWN: {
            type: 'final',
          },
        },
      },
      {
        actions: {
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          incomingRoapOffer: (context: MediaContext, event: RoapEvent) =>
            this.handleIncomingRoapOffer(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          incomingRoapAnswer: (context: MediaContext, event: RoapEvent) =>
            this.handleIncomingRoapAnswer(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          incomingRoapOfferRequest: (context: MediaContext, event: RoapEvent) =>
            this.handleIncomingRoapOfferRequest(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          outgoingRoapOffer: (context: MediaContext, event: RoapEvent) =>
            this.handleOutgoingRoapOffer(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          outgoingRoapAnswer: (context: MediaContext, event: RoapEvent) =>
            this.handleOutgoingRoapAnswer(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          roapEstablished: (context: MediaContext, event: RoapEvent) =>
            this.handleRoapEstablished(context, event),
          /**
           * .
           *
           * @param context -.
           * @param event -.
           */
          roapError: (context: MediaContext, event: RoapEvent) =>
            this.handleRoapError(context, event),
        },
      }
    );

    this.callStateMachine = interpret(callMachine)
      .onTransition((state, event) => {
        log.log(
          `Call StateMachine:- state=${state.value}, event=${JSON.stringify(event.type)}`,
          {}
        );
        if (state.value !== 'S_UNKNOWN') {
          this.metricManager.submitCallMetric(
            METRIC_EVENT.CALL,
            state.value.toString(),
            METRIC_TYPE.BEHAVIORAL,
            this.callId,
            this.correlationId,
            undefined
          );
        }
      })
      .start();

    this.mediaStateMachine = interpret(mediaMachine)
      .onTransition((state, event) => {
        log.log(
          `Media StateMachine:- state=${state.value}, event=${JSON.stringify(event.type)}`,
          {}
        );
        if (state.value !== 'S_ROAP_ERROR') {
          this.metricManager.submitMediaMetric(
            METRIC_EVENT.MEDIA,
            state.value.toString(),
            METRIC_TYPE.BEHAVIORAL,
            this.callId,
            this.correlationId,
            this.localRoapMessage.sdp,
            this.remoteRoapMessage?.sdp,
            undefined
          );
        }
      })
      .start();
    this.muted = false;
  }

  /**
   * Handle incoming Call setups.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleIncomingCallSetup(event: CallEvent) {
    log.info(`handleIncomingCallSetup: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleIncomingCallSetup.name,
    });

    this.sendCallStateMachineEvt({type: 'E_SEND_CALL_ALERTING'});
  }

  /**
   * Handle outgoing Call setups.
   * The handler sends a Post Message to the remote with ROAP body
   * as offer. We also set the callId here based on the response received.
   *
   * @param event - Call Events.
   */
  private async handleOutgoingCallSetup(event: CallEvent) {
    log.info(`handleOutgoingCallSetup: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleOutgoingCallSetup.name,
    });

    const message = event.data as RoapMessage;

    try {
      const response = await this.post(message);

      log.log(`handleOutgoingCallSetup: Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingCallSetup.name,
      });
      this.setCallId(response.body.callId);
    } catch (e) {
      log.warn('Failed to setup the call', {
        file: CALL_FILE,
        method: this.handleOutgoingCallSetup.name,
      });
      const errData = e as MobiusCallResponse;

      handleCallErrors(
        (error: CallError) => {
          this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_UNKNOWN', data: errData});
        },
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        /* istanbul ignore next */ (interval: number) => undefined,
        this.getCorrelationId(),
        errData,
        this.handleOutgoingCallSetup.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle Call Hold.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleCallHold(event: CallEvent) {
    log.info(`handleCallHold: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleCallHold.name,
    });

    try {
      const response = await this.postSSRequest(undefined, SUPPLEMENTARY_SERVICES.HOLD);

      log.log(`Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleCallHold.name,
      });

      /*
       *  Avoid setting http response timeout if held event is already
       *  received from Mobius and forwarded towards calling client
       */
      if (this.isHeld() === false) {
        this.supplementaryServicesTimer = setTimeout(async () => {
          const errorContext = {file: CALL_FILE, method: this.handleCallHold.name};

          log.warn('Hold response timed out', {
            file: CALL_FILE,
            method: this.handleCallHold.name,
          });

          const callError = createCallError(
            'An error occurred while placing the call on hold. Wait a moment and try again.',
            errorContext as ErrorContext,
            ERROR_TYPE.TIMEOUT,
            this.getCorrelationId(),
            ERROR_LAYER.CALL_CONTROL
          );

          this.emit(CALL_EVENT_KEYS.HOLD_ERROR, callError);
          this.submitCallErrorMetric(callError);
        }, SUPPLEMENTARY_SERVICES_TIMEOUT);
      }
    } catch (e) {
      log.warn('Failed to put the call on hold', {
        file: CALL_FILE,
        method: this.handleCallHold.name,
      });
      const errData = e as MobiusCallResponse;

      handleCallErrors(
        (error: CallError) => {
          this.emit(CALL_EVENT_KEYS.HOLD_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
        },
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        /* istanbul ignore next */ (interval: number) => undefined,
        this.getCorrelationId(),
        errData,
        this.handleOutgoingCallSetup.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle Call Resume.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleCallResume(event: CallEvent) {
    log.info(`handleCallResume: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleCallResume.name,
    });

    try {
      const response = await this.postSSRequest(undefined, SUPPLEMENTARY_SERVICES.RESUME);

      log.log(`Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleCallResume.name,
      });

      /*
       *  Avoid setting http response timeout if connected event is already
       *  received from Mobius on resuming the call and forwarded towards calling client
       */
      if (this.isHeld() === true) {
        this.supplementaryServicesTimer = setTimeout(async () => {
          const errorContext = {file: CALL_FILE, method: this.handleCallResume.name};

          log.warn('Resume response timed out', {
            file: CALL_FILE,
            method: this.handleCallResume.name,
          });

          const callError = createCallError(
            'An error occurred while resuming the call. Wait a moment and try again.',
            errorContext as ErrorContext,
            ERROR_TYPE.TIMEOUT,
            this.getCorrelationId(),
            ERROR_LAYER.CALL_CONTROL
          );

          this.emit(CALL_EVENT_KEYS.RESUME_ERROR, callError);
          this.submitCallErrorMetric(callError);
        }, SUPPLEMENTARY_SERVICES_TIMEOUT);
      }
    } catch (e) {
      log.warn('Failed to resume the call', {
        file: CALL_FILE,
        method: this.handleCallResume.name,
      });
      const errData = e as MobiusCallResponse;

      handleCallErrors(
        (error: CallError) => {
          this.emit(CALL_EVENT_KEYS.RESUME_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
        },
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        /* istanbul ignore next */ (interval: number) => undefined,
        this.getCorrelationId(),
        errData,
        this.handleOutgoingCallSetup.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle incoming Call Progress.
   *
   * @param event - Call Events.
   */
  private handleIncomingCallProgress(event: CallEvent) {
    log.info(`handleIncomingCallProgress: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleIncomingCallProgress.name,
    });
    const data = event.data as MobiusCallData;

    if (data?.callProgressData?.inbandMedia) {
      log.log('Inband media present. Setting Early Media flag', {
        file: CALL_FILE,
        method: this.handleIncomingCallProgress.name,
      });
      this.earlyMedia = true;
    } else {
      log.log('Inband media not present.', {
        file: CALL_FILE,
        method: this.handleIncomingCallProgress.name,
      });
    }

    if (data?.callerId) {
      log.info('Processing Caller-Id data', {
        file: CALL_FILE,
        method: this.handleIncomingCallProgress.name,
      });
      this.startCallerIdResolution(data.callerId);
    }
    this.emit(CALL_EVENT_KEYS.PROGRESS, this.correlationId);
  }

  /**
   * Handle incoming Call Progress.
   *
   * @param context
   * @param event - Roap Events.
   */
  private handleIncomingRoapOfferRequest(context: MediaContext, event: RoapEvent) {
    log.info(`handleIncomingRoapOfferRequest: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleIncomingRoapOfferRequest.name,
    });
    const message = event.data as RoapMessage;

    if (!this.mediaConnection) {
      log.info('Media connection is not up, buffer the remote Offer Request for later handling', {
        file: CALL_FILE,
        method: this.handleIncomingRoapOfferRequest.name,
      });

      this.seq = message.seq;
      log.info(`Setting Sequence No: ${this.seq}`, {
        file: CALL_FILE,
        method: this.handleIncomingRoapOfferRequest.name,
      });

      this.remoteRoapMessage = message;
    } else if (this.receivedRoapOKSeq === message.seq - 2) {
      log.info('Waiting for Roap OK, buffer the remote Offer Request for later handling', {
        file: CALL_FILE,
        method: this.handleIncomingRoapOfferRequest.name,
      });

      this.remoteRoapMessage = message;
    } else {
      message.seq = this.seq + 1;
      this.seq = message.seq;
      this.mediaConnection.roapMessageReceived(message);
    }
  }

  /**
   * Handle Outgoing Call Progress.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleOutgoingCallAlerting(event: CallEvent) {
    log.info(`handleOutgoingCallAlerting: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleOutgoingCallAlerting.name,
    });

    try {
      const res = await this.patch(MobiusCallState.ALERTING);

      log.log(`PATCH response: ${res.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingCallAlerting.name,
      });
    } catch (err) {
      log.warn('Failed to signal call progression', {
        file: CALL_FILE,
        method: this.handleOutgoingCallAlerting.name,
      });
      const errData = err as MobiusCallResponse;

      handleCallErrors(
        (error: CallError) => {
          this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_UNKNOWN', data: errData});
        },
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        /* istanbul ignore next */ (interval: number) => undefined,
        this.getCorrelationId(),
        errData,
        this.handleOutgoingCallAlerting.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle incoming Call Connect.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleIncomingCallConnect(event: CallEvent) {
    log.info(`handleIncomingCallConnect: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleIncomingCallConnect.name,
    });
    this.emit(CALL_EVENT_KEYS.CONNECT, this.correlationId);

    /* In case of Early Media , media negotiations would have already started
     * So we can directly go to call established state */

    if (this.earlyMedia || this.mediaNegotiationCompleted) {
      this.mediaNegotiationCompleted = false;
      this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED'});
    }
  }

  /**
   * Handle outgoing Call Connect.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleOutgoingCallConnect(event: CallEvent) {
    log.info(`handleOutgoingCallConnect: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleOutgoingCallConnect.name,
    });

    /* We should have received an Offer by now */
    if (!this.remoteRoapMessage) {
      log.warn('Offer not yet received from remote end... Exiting', {
        file: CALL_FILE,
        method: this.handleOutgoingCallConnect.name,
      });

      return;
    }

    try {
      /* Start Offer/Answer as we might have buffered the offer by now */
      this.mediaConnection.roapMessageReceived(this.remoteRoapMessage);

      /* send call_connect PATCH */
      const res = await this.patch(MobiusCallState.CONNECTED);

      log.log(`PATCH response: ${res.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingCallConnect.name,
      });
    } catch (err) {
      log.warn('Failed to connect the call', {
        file: CALL_FILE,
        method: this.handleOutgoingCallConnect.name,
      });
      const errData = err as MobiusCallResponse;

      handleCallErrors(
        (error: CallError) => {
          this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_UNKNOWN', data: errData});
        },
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        /* istanbul ignore next */ (interval: number) => undefined,
        this.getCorrelationId(),
        errData,
        this.handleOutgoingCallConnect.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle incoming Call Disconnect.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleIncomingCallDisconnect(event: CallEvent) {
    log.info(`handleIncomingCallDisconnect: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleIncomingCallDisconnect.name,
    });

    this.setDisconnectReason();

    try {
      const response = await this.delete();

      log.log(`handleOutgoingCallDisconnect: Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleIncomingCallDisconnect.name,
      });
    } catch (e) {
      log.warn('Failed to delete the call', {
        file: CALL_FILE,
        method: this.handleIncomingCallDisconnect.name,
      });
    }

    this.deleteCb(this.correlationId);

    /* Clear the stream listeners */
    this.unregisterListeners();

    /* istanbul ignore else */
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    /* istanbul ignore else */
    if (this.mediaConnection) {
      this.mediaConnection.close();
      log.info('Closing media channel', {file: CALL_FILE, method: 'handleIncomingCallDisconnect'});
    }

    this.sendMediaStateMachineEvt({type: 'E_ROAP_TEARDOWN'});
    this.sendCallStateMachineEvt({type: 'E_CALL_CLEARED'});

    this.emit(CALL_EVENT_KEYS.DISCONNECT, this.correlationId);
  }

  /**
   * Handle outgoing Call Disconnect.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleOutgoingCallDisconnect(event: CallEvent) {
    this.setDisconnectReason();

    try {
      const response = await this.delete();

      log.log(`handleOutgoingCallDisconnect: Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingCallDisconnect.name,
      });
    } catch (e) {
      log.warn('Failed to delete the call', {
        file: CALL_FILE,
        method: this.handleOutgoingCallDisconnect.name,
      });
    }

    this.deleteCb(this.correlationId);

    /* Clear the stream listeners */
    this.unregisterListeners();

    /* istanbul ignore else */
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    /* istanbul ignore else */
    if (this.mediaConnection) {
      this.mediaConnection.close();
      log.info('Closing media channel', {file: CALL_FILE, method: 'handleOutgoingCallDisconnect'});
    }

    this.sendMediaStateMachineEvt({type: 'E_ROAP_TEARDOWN'});
    this.sendCallStateMachineEvt({type: 'E_CALL_CLEARED'});
  }

  /**
   * Handle Call Established - Roap related negotiations.
   *
   * @param event - Call Events.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleCallEstablished(event: CallEvent) {
    log.info(`handleCallEstablished: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleCallEstablished.name,
    });

    this.emit(CALL_EVENT_KEYS.ESTABLISHED, this.correlationId);

    /* Reset Early dialog parameters */
    this.earlyMedia = false;

    this.connected = true;

    /* Session timers need to be reset at all offer/answer exchanges */
    if (this.sessionTimer) {
      log.log('Resetting session timer', {
        file: CALL_FILE,
        method: 'handleCallEstablished',
      });
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const res = await this.postStatus();

        log.info(`Session refresh successful`, {
          file: CALL_FILE,
          method: 'handleCallEstablished',
        });
      } catch (err: unknown) {
        const error = <WebexRequestPayload>err;

        /* We are clearing the timer here as all are error scenarios. Only scenario where
         * timer reset won't be required is 503 with retry after. But that case will
         * be handled automatically as Mobius will also reset timer when we post status
         * in retry-after scenario.
         */
        /* istanbul ignore next */
        if (this.sessionTimer) {
          clearInterval(this.sessionTimer);
        }

        handleCallErrors(
          (callError: CallError) => {
            this.emit(CALL_EVENT_KEYS.CALL_ERROR, callError);
            this.submitCallErrorMetric(callError);
          },
          ERROR_LAYER.CALL_CONTROL,
          (interval: number) => {
            setTimeout(() => {
              /* We first post the status and then recursively call the handler which
               * starts the timer again
               */
              this.postStatus();
              this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED'});
            }, interval * 1000);
          },
          this.getCorrelationId(),
          error,
          this.handleCallEstablished.name,
          CALL_FILE
        );
      }
    }, DEFAULT_SESSION_TIMER);
  }

  /**
   * Handle Unknown events.
   *
   * @param event - Call Events.
   */
  private async handleUnknownState(event: CallEvent) {
    log.info(`handleUnknownState: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: this.handleUnknownState.name,
    });

    /* We are handling errors at the source , in this state we just log and
     * clear the resources
     */

    const eventData = event.data as {media: boolean};

    if (!eventData?.media) {
      log.warn('Call failed due to signalling issue', {
        file: CALL_FILE,
        method: this.handleUnknownState.name,
      });
    }

    /* We need to clear the call at Mobius too. For delete failure
     * error handling is not required
     */

    try {
      this.setDisconnectReason();
      const response = await this.delete();

      log.log(`handleOutgoingCallDisconnect: Response code: ${response.statusCode}`, {
        file: CALL_FILE,
        method: this.handleUnknownState.name,
      });
    } catch (e) {
      log.warn('Failed to delete the call', {
        file: CALL_FILE,
        method: this.handleUnknownState.name,
      });
    }

    this.deleteCb(this.correlationId);

    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    if (this.mediaConnection) {
      this.mediaConnection.close();
      log.info('Closing media channel', {
        file: CALL_FILE,
        method: this.handleUnknownState.name,
      });
    }
    this.sendMediaStateMachineEvt({type: 'E_ROAP_TEARDOWN'});
    this.sendCallStateMachineEvt({type: 'E_CALL_CLEARED'});
  }

  /**
   * Returns an error emitter callback method for handleCallErrors which can be used during
   * midcall and call setup scenarios.
   * Emits Call errors for UI Client
   * Sends call error metrics
   * Handles further state machine changes.
   *
   * @param errData - Instance of CallError.
   */
  private getEmitterCallback(errData: MobiusCallResponse) {
    return (error: CallError) => {
      switch (this.callStateMachine.state.value) {
        case 'S_CALL_HOLD':
          this.emit(CALL_EVENT_KEYS.HOLD_ERROR, error);
          if (this.supplementaryServicesTimer) {
            clearTimeout(this.supplementaryServicesTimer);
            this.supplementaryServicesTimer = undefined;
          }
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});

          return;
        case 'S_CALL_RESUME':
          this.emit(CALL_EVENT_KEYS.RESUME_ERROR, error);
          this.submitCallErrorMetric(error);
          this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});

          return;
        default:
          this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
          this.submitCallErrorMetric(error);
          /* Disconnect call if it's not a midcall case */
          /* istanbul ignore else */
          if (!this.connected) {
            this.sendMediaStateMachineEvt({type: 'E_ROAP_ERROR', data: errData});
          }
      }
    };
  }

  /**
   * Handle Roap Established events.
   *
   * For outbound MediaOk , the message will be truthy as we need to send ROAP OK .
   * For inbound MediaOK , we report it to Media-SDK  and transition our state.
   * Both the cases should transition to Call Established state.
   *
   * @param context -.
   * @param event - Roap Events.
   */
  private async handleRoapEstablished(context: MediaContext, event: RoapEvent) {
    log.info(`handleRoapEstablished: ${this.getCorrelationId()}  `, {
      file: CALL_FILE,
      method: 'handleRoapEstablished',
    });

    const {received, message} = event.data as {received: boolean; message: RoapMessage};

    this.receivedRoapOKSeq = message.seq;

    if (!received) {
      log.info('Sending Media Ok to the remote End', {
        file: CALL_FILE,
        method: 'handleRoapEstablished',
      });

      try {
        if (
          this.callStateMachine.state.value === 'S_RECV_CALL_PROGRESS' ||
          this.callStateMachine.state.value === 'S_SEND_CALL_SETUP'
        ) {
          log.info(
            'Media negotiation completed before call connect. Setting media negotiation completed flag.',
            {
              file: CALL_FILE,
              method: 'handleRoapEstablished',
            }
          );
          this.mediaNegotiationCompleted = true;
        }
        message.seq = this.seq;
        const res = await this.postMedia(message);

        log.log(`handleRoapEstablished: Response code: ${res.statusCode}`, {
          file: CALL_FILE,
          method: 'handleRoapEstablished',
        });
        /* istanbul ignore else */
        if (!this.earlyMedia && !this.mediaNegotiationCompleted) {
          this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED'});
        }
      } catch (err) {
        log.warn('Failed to process MediaOk request', {
          file: CALL_FILE,
          method: 'handleRoapEstablished',
        });
        const errData = err as MobiusCallResponse;

        handleCallErrors(
          this.getEmitterCallback(errData),
          ERROR_LAYER.MEDIA,
          (interval: number) => {
            /* Start retry if only it is a midcall case */
            /* istanbul ignore else */
            if (this.connected) {
              setTimeout(() => {
                this.sendMediaStateMachineEvt({type: 'E_ROAP_OK', data: event.data});
              }, interval * 1000);
            }
          },
          this.getCorrelationId(),
          errData,
          this.handleRoapEstablished.name,
          CALL_FILE
        );
      }
    } else {
      log.info('Notifying internal-media-core about ROAP OK message', {
        file: CALL_FILE,
        method: 'handleRoapEstablished',
      });
      message.seq = this.seq;

      /* istanbul ignore else */
      if (this.mediaConnection) {
        this.mediaConnection.roapMessageReceived(message);
      }
      /* istanbul ignore else */
      if (!this.earlyMedia) {
        this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED'});
      }

      if (this.remoteRoapMessage && this.remoteRoapMessage.seq > this.seq) {
        if (this.remoteRoapMessage.messageType === 'OFFER_REQUEST') {
          this.sendMediaStateMachineEvt({
            type: 'E_RECV_ROAP_OFFER_REQUEST',
            data: this.remoteRoapMessage,
          });
        } else if (this.remoteRoapMessage.messageType === 'OFFER') {
          this.sendMediaStateMachineEvt({type: 'E_RECV_ROAP_OFFER', data: this.remoteRoapMessage});
        }
      }
    }
  }

  /**
   * Handle Roap Error events.
   *
   * @param context
   * @param event - Roap Events.
   */
  private async handleRoapError(context: MediaContext, event: RoapEvent) {
    log.info(`handleRoapError: ${this.getCorrelationId()}`, {
      file: CALL_FILE,
      method: this.handleRoapError.name,
    });

    /* if we receive ROAP_ERROR from internal-media-core , we post it to Mobius */

    const message = event.data as RoapMessage;

    /* istanbul ignore else */
    if (message) {
      try {
        const res = await this.postMedia(message);

        log.info(`Response code: ${res.statusCode}`, {
          file: CALL_FILE,
          method: this.handleRoapError.name,
        });
      } catch (err) {
        log.warn('Failed to communicate ROAP error to Webex Calling', {
          file: CALL_FILE,
          method: this.handleRoapError.name,
        });
        const errData = err as MobiusCallResponse;

        handleCallErrors(
          (error: CallError) => {
            this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
            this.submitCallErrorMetric(error);
          },
          ERROR_LAYER.MEDIA,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          /* istanbul ignore next */ (interval: number) => undefined,
          this.getCorrelationId(),
          errData,
          this.handleRoapError.name,
          CALL_FILE
        );
      }
    }

    /* Only disconnect calls that are not yet connected yet */

    if (!this.connected) {
      log.warn('Call failed due to media issue', {
        file: CALL_FILE,
        method: 'handleRoapError',
      });

      this.sendCallStateMachineEvt({type: 'E_UNKNOWN', data: {media: true}});
    }
  }

  /**
   * Handle Outgoing Roap Offer events.
   *
   * @param context
   * @param event - Roap Events.
   */
  private async handleOutgoingRoapOffer(context: MediaContext, event: RoapEvent) {
    log.info(`handleOutgoingRoapOffer: ${this.getCorrelationId()}`, {
      file: CALL_FILE,
      method: this.handleOutgoingRoapOffer.name,
    });

    const message = event.data as RoapMessage;

    if (!message?.sdp) {
      log.info('Initializing Offer...', {
        file: CALL_FILE,
        method: this.handleOutgoingRoapOffer.name,
      });
      this.mediaConnection.initiateOffer();

      return;
    }

    /* If we are here , that means we have a message to send.. */

    try {
      const res = await this.postMedia(message);

      log.log(`handleOutgoingRoapOffer: Response code: ${res.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingRoapOffer.name,
      });
    } catch (err) {
      log.warn('Failed to process MediaOk request', {
        file: CALL_FILE,
        method: this.handleOutgoingRoapOffer.name,
      });
      const errData = err as MobiusCallResponse;

      handleCallErrors(
        this.getEmitterCallback(errData),
        ERROR_LAYER.MEDIA,
        (interval: number) => {
          /* Start retry if only it is a midcall case */
          if (this.connected) {
            setTimeout(() => {
              this.sendMediaStateMachineEvt({type: 'E_SEND_ROAP_OFFER', data: event.data});
            }, interval * 1000);
          }
        },
        this.getCorrelationId(),
        errData,
        this.handleOutgoingRoapOffer.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle Outgoing Roap Answer events.
   *
   * @param context
   * @param event - Roap Events.
   */
  private async handleOutgoingRoapAnswer(context: MediaContext, event: RoapEvent) {
    log.info(`handleOutgoingRoapAnswer: ${this.getCorrelationId()}`, {
      file: CALL_FILE,
      method: this.handleOutgoingRoapAnswer.name,
    });

    const message = event.data as RoapMessage;

    try {
      message.seq = this.seq;
      const res = await this.postMedia(message);

      log.log(`handleOutgoingRoapAnswer: Response code: ${res.statusCode}`, {
        file: CALL_FILE,
        method: this.handleOutgoingRoapAnswer.name,
      });
    } catch (err) {
      log.warn('Failed to send MediaAnswer request', {
        file: CALL_FILE,
        method: this.handleOutgoingRoapAnswer.name,
      });
      const errData = err as MobiusCallResponse;

      handleCallErrors(
        this.getEmitterCallback(errData),
        ERROR_LAYER.MEDIA,
        (interval: number) => {
          /* Start retry if only it is a midcall case */
          if (this.connected) {
            setTimeout(() => {
              this.sendMediaStateMachineEvt({type: 'E_SEND_ROAP_ANSWER', data: event.data});
            }, interval * 1000);
          }
        },
        this.getCorrelationId(),
        errData,
        this.handleOutgoingRoapAnswer.name,
        CALL_FILE
      );
    }
  }

  /**
   * Handle Incoming Roap Offer events.
   *
   * @param context
   * @param event - Roap Events.
   */
  private handleIncomingRoapOffer(context: MediaContext, event: RoapEvent) {
    log.info(`handleIncomingRoapOffer: ${this.getCorrelationId()}`, {
      file: CALL_FILE,
      method: this.handleIncomingRoapOffer.name,
    });

    const message = event.data as RoapMessage;

    this.remoteRoapMessage = message;
    if (!this.mediaConnection) {
      log.info('Media connection is not up, buffer the remote offer for later handling', {
        file: CALL_FILE,
        method: this.handleIncomingRoapOffer.name,
      });
      this.seq = message.seq;
      log.info(`Setting Sequence No: ${this.seq}`, {
        file: CALL_FILE,
        method: this.handleIncomingRoapOffer.name,
      });
    } else if (this.receivedRoapOKSeq === message.seq - 2) {
      log.info('Waiting for Roap OK, buffer the remote offer for later handling', {
        file: CALL_FILE,
        method: this.handleIncomingRoapOffer.name,
      });

      this.remoteRoapMessage = message;
    } else {
      log.info('Handling new offer...', {
        file: CALL_FILE,
        method: this.handleIncomingRoapOffer.name,
      });
      this.seq = message.seq;
      /* istanbul ignore else */
      if (this.mediaConnection) {
        this.mediaConnection.roapMessageReceived(message);
      }
    }
  }

  /**
   * Handle Incoming Roap Answer events.
   *
   * @param context
   * @param event - Roap Events.
   */
  private handleIncomingRoapAnswer(context: MediaContext, event: RoapEvent) {
    log.info(`handleIncomingRoapAnswer: ${this.getCorrelationId()}`, {
      file: CALL_FILE,
      method: this.handleIncomingRoapAnswer.name,
    });
    const message = event.data as RoapMessage;

    this.remoteRoapMessage = message;
    message.seq = this.seq;
    /* istanbul ignore else */
    if (this.mediaConnection) {
      this.mediaConnection.roapMessageReceived(message);
    }
  }

  /* istanbul ignore next */
  /**
   * Initialize Media Connection.
   *
   * @param settings -.
   * @param settings.localAudioTrack - MediaStreamTrack.
   * @param settings.debugId - String.
   */
  private initMediaConnection(localAudioTrack: MediaStreamTrack, debugId?: string) {
    const mediaConnection = new RoapMediaConnection(
      {
        skipInactiveTransceivers: true,
        iceServers: [],
        iceCandidatesTimeout: ICE_CANDIDATES_TIMEOUT,
        sdpMunging: {
          convertPort9to0: true,
          addContentSlides: false,
          copyClineToSessionLevel: true,
        },
      },
      {
        localTracks: {audio: localAudioTrack},
        direction: {
          audio: 'sendrecv',
          video: 'inactive',
          screenShareVideo: 'inactive',
        },
      },
      debugId || `WebexCallSDK-${this.correlationId}`
    );

    this.mediaConnection = mediaConnection;
  }

  /**
   *
   */
  public getDirection = (): CallDirection => this.direction;

  /**
   *
   */
  public getCallId = (): CallId => this.callId;

  /**
   *
   */
  public getCorrelationId = (): CorrelationId => this.correlationId;

  /**
   * .
   *
   * @param event -.
   */
  public sendCallStateMachineEvt(event: CallEvent) {
    this.callStateMachine.send(event);
  }

  /**
   * .
   *
   * @param event -.
   */
  public sendMediaStateMachineEvt(event: RoapEvent) {
    this.mediaStateMachine.send(event);
  }

  /**
   * @param callId -.
   */
  public setCallId = (callId: CallId) => {
    this.callId = callId;
    log.info(`Setting callId : ${this.callId} for correlationId: ${this.correlationId}`, {
      file: CALL_FILE,
      method: this.setCallId.name,
    });
  };

  /**
   * Sets the Disconnect reason.
   *
   */
  private setDisconnectReason() {
    if (this.mediaInactivity) {
      this.disconnectReason.code = DisconnectCode.MEDIA_INACTIVITY;
      this.disconnectReason.cause = DisconnectCause.MEDIA_INACTIVITY;
    } else if (this.connected || this.direction === CallDirection.OUTBOUND) {
      this.disconnectReason.code = DisconnectCode.NORMAL;
      this.disconnectReason.cause = DisconnectCause.NORMAL;
    } else {
      this.disconnectReason.code = DisconnectCode.BUSY;
      this.disconnectReason.cause = DisconnectCause.BUSY;
    }
  }

  /**
   * Gets the disconnection reason.
   *
   * @returns Reason.
   */
  public getDisconnectReason = (): DisconnectReason => {
    return this.disconnectReason;
  };

  /**
   * Answers the call with the provided local audio stream.
   *
   * @param localAudioStream - The local audio stream for the call.
   */
  public async answer(localAudioStream: LocalMicrophoneStream) {
    this.localAudioStream = localAudioStream;
    const localAudioTrack = localAudioStream.outputStream.getAudioTracks()[0];

    if (!localAudioTrack) {
      log.warn(`Did not find a local track while answering the call ${this.getCorrelationId()}`, {
        file: CALL_FILE,
        method: 'answer',
      });
      this.mediaInactivity = true;
      this.sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'});

      return;
    }

    localAudioTrack.enabled = true;

    if (!this.mediaConnection) {
      this.initMediaConnection(localAudioTrack);
      this.mediaRoapEventsListener();
      this.mediaTrackListener();
      this.registerListeners(localAudioStream);
    }

    if (this.callStateMachine.state.value === 'S_SEND_CALL_PROGRESS') {
      this.sendCallStateMachineEvt({type: 'E_SEND_CALL_CONNECT'});
    } else {
      log.warn(
        `Call cannot be answered because the state is : ${this.callStateMachine.state.value}`,
        {file: CALL_FILE, method: 'answer'}
      );
    }
  }

  /**
   * @param settings
   * @param settings.localAudioTrack
   */
  public async dial(localAudioStream: LocalMicrophoneStream) {
    this.localAudioStream = localAudioStream;
    const localAudioTrack = localAudioStream.outputStream.getAudioTracks()[0];

    if (!localAudioTrack) {
      log.warn(`Did not find a local track while dialing the call ${this.getCorrelationId()}`, {
        file: CALL_FILE,
        method: 'dial',
      });

      this.deleteCb(this.getCorrelationId());
      this.emit(CALL_EVENT_KEYS.DISCONNECT, this.getCorrelationId());

      return;
    }
    localAudioTrack.enabled = true;

    if (!this.mediaConnection) {
      this.initMediaConnection(localAudioTrack);
      this.mediaRoapEventsListener();
      this.mediaTrackListener();
      this.registerListeners(localAudioStream);
    }

    if (this.mediaStateMachine.state.value === 'S_ROAP_IDLE') {
      this.sendMediaStateMachineEvt({type: 'E_SEND_ROAP_OFFER'});
    } else {
      log.warn(
        `Call cannot be dialed because the state is already : ${this.mediaStateMachine.state.value}`,
        {file: CALL_FILE, method: 'dial'}
      );
    }
  }

  /**
   * .
   *
   * @param roapMessage
   */
  private post = async (roapMessage: RoapMessage): Promise<MobiusCallResponse> => {
    return this.webex.request({
      uri: `${this.mobiusUrl}${DEVICES_ENDPOINT_RESOURCE}/${this.deviceId}/${CALL_ENDPOINT_RESOURCE}`,
      method: HTTP_METHODS.POST,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callee: {
          type: this.destination.type,
          address: this.destination.address,
        },
        localMedia: {
          roap: roapMessage,
          mediaId: uuid(),
        },
      },
    });
  };

  /**
   * .
   *
   * @param state -.
   */
  private async patch(state: MobiusCallState): Promise<PatchResponse> {
    log.info(`Send a PATCH for ${state} to Webex Calling`, {
      file: CALL_FILE,
      method: this.patch.name,
    });

    return this.webex.request({
      // Sample uri: http://localhost/api/v1/calling/web/devices/{deviceid}/calls/{callid}

      uri: `${this.mobiusUrl}${DEVICES_ENDPOINT_RESOURCE}/${this.deviceId}/${CALLS_ENDPOINT_RESOURCE}/${this.callId}`,
      method: HTTP_METHODS.PATCH,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callId: this.callId,
        callState: state,
        inbandMedia: false, // setting false for now
      },
    });
  }

  /**
   * Sends Supplementary request to Mobius.
   *
   * @param context - Context information related to a particular supplementary service.
   * @param type - Type of Supplementary service.
   */
  public async postSSRequest(context: unknown, type: SUPPLEMENTARY_SERVICES): Promise<SSResponse> {
    const request = {
      uri: `${this.mobiusUrl}${SERVICES_ENDPOINT}`,
      method: HTTP_METHODS.POST,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callId: this.callId,
      },
    };

    switch (type) {
      case SUPPLEMENTARY_SERVICES.HOLD: {
        request.uri = `${request.uri}/${CALL_HOLD_SERVICE}/${HOLD_ENDPOINT}`;
        break;
      }
      case SUPPLEMENTARY_SERVICES.RESUME: {
        request.uri = `${request.uri}/${CALL_HOLD_SERVICE}/${RESUME_ENDPOINT}`;
        break;
      }
      case SUPPLEMENTARY_SERVICES.TRANSFER: {
        request.uri = `${request.uri}/${CALL_TRANSFER_SERVICE}/${TRANSFER_ENDPOINT}`;
        const transferContext = context as TransferContext;

        if (transferContext.destination) {
          Object.assign(request.body, {blindTransferContext: transferContext});
          Object.assign(request.body, {transferType: TransferType.BLIND});
        } /* istanbul ignore else */ else if (transferContext.transferToCallId) {
          Object.assign(request.body, {consultTransferContext: transferContext});
          Object.assign(request.body, {transferType: TransferType.CONSULT});
        }
        break;
      }
      default: {
        log.warn(`Unknown type for PUT request: ${type}`, {
          file: CALL_FILE,
          method: this.postSSRequest.name,
        });
      }
    }

    return this.webex.request(request);
  }

  /**
   * Sends Call status to Mobius.
   */
  public async postStatus(): Promise<WebexRequestPayload> {
    return this.webex.request({
      uri: `${this.mobiusUrl}${DEVICES_ENDPOINT_RESOURCE}/${this.deviceId}/${CALLS_ENDPOINT_RESOURCE}/${this.callId}/${CALL_STATUS_RESOURCE}`,
      method: HTTP_METHODS.POST,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callId: this.callId,
      },
    });
  }

  /**
   * This function is called when user attempts to complete transfer(Blind or Consult)
   * It checks if we have a valid transferCallId or transfer target and transfer type.
   *
   * @param transferType - Transfer type.
   * @param transferCallId - Call Id where the current call will be merged for consult transfers.
   * @param transferTarget - Destination for blind transfer.
   */
  public async completeTransfer(
    transferType: TransferType,
    transferCallId?: CallId,
    transferTarget?: string
  ) {
    if (transferType === TransferType.BLIND && transferTarget) {
      /* blind transfer */

      log.info(`Initiating Blind transfer with : ${transferTarget}`, {
        file: CALL_FILE,
        method: this.completeTransfer.name,
      });

      const context: TransferContext = {
        transferorCallId: this.getCallId(),
        destination: transferTarget,
      };

      try {
        await this.postSSRequest(context, SUPPLEMENTARY_SERVICES.TRANSFER);
        this.metricManager.submitCallMetric(
          METRIC_EVENT.CALL,
          TRANSFER_ACTION.BLIND,
          METRIC_TYPE.BEHAVIORAL,
          this.getCallId(),
          this.getCorrelationId(),
          undefined
        );
      } catch (e) {
        log.warn(`Blind Transfer failed for correlationId ${this.getCorrelationId()}`, {
          file: CALL_FILE,
          method: this.completeTransfer.name,
        });

        const errData = e as MobiusCallResponse;

        handleCallErrors(
          (error: CallError) => {
            this.emit(CALL_EVENT_KEYS.TRANSFER_ERROR, error);
            this.submitCallErrorMetric(error, TRANSFER_ACTION.BLIND);
          },
          ERROR_LAYER.CALL_CONTROL,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          /* istanbul ignore next */ (interval: number) => undefined,
          this.getCorrelationId(),
          errData,
          this.completeTransfer.name,
          CALL_FILE
        );
      }
    } else if (transferType === TransferType.CONSULT && transferCallId) {
      /* Consult transfer */

      log.info(`Initiating Consult transfer between : ${this.callId} and ${transferCallId}`, {
        file: CALL_FILE,
        method: this.completeTransfer.name,
      });

      const context: TransferContext = {
        transferorCallId: this.getCallId(),
        transferToCallId: transferCallId,
      };

      try {
        await this.postSSRequest(context, SUPPLEMENTARY_SERVICES.TRANSFER);
        this.metricManager.submitCallMetric(
          METRIC_EVENT.CALL,
          TRANSFER_ACTION.CONSULT,
          METRIC_TYPE.BEHAVIORAL,
          this.getCallId(),
          this.getCorrelationId(),
          undefined
        );
      } catch (e) {
        log.warn(`Consult Transfer failed for correlationId ${this.getCorrelationId()}`, {
          file: CALL_FILE,
          method: this.completeTransfer.name,
        });

        const errData = e as MobiusCallResponse;

        handleCallErrors(
          (error: CallError) => {
            this.emit(CALL_EVENT_KEYS.TRANSFER_ERROR, error);
            this.submitCallErrorMetric(error, TRANSFER_ACTION.CONSULT);
          },
          ERROR_LAYER.CALL_CONTROL,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          /* istanbul ignore next */ (interval: number) => undefined,
          this.getCorrelationId(),
          errData,
          this.completeTransfer.name,
          CALL_FILE
        );
      }
    } else {
      log.warn(
        `Invalid information received, transfer failed for correlationId: ${this.getCorrelationId()}`,
        {
          file: CALL_FILE,
          method: this.completeTransfer.name,
        }
      );
    }
  }

  /**
   *
   */
  private async getCallStats(): Promise<CallRtpStats> {
    let stats!: RTCStatsReport;

    try {
      stats = await this.mediaConnection.getStats();
    } catch (err) {
      log.warn('Stats collection failed, using dummy stats', {
        file: CALL_FILE,
        method: this.getCallStats.name,
      });
    }

    return parseMediaQualityStatistics(stats);
  }

  /**
   * .
   *
   * @param roapMessage -.
   */
  private async postMedia(roapMessage: RoapMessage): Promise<WebexRequestPayload> {
    log.log('Posting message to Webex Calling', {
      file: CALL_FILE,
      method: this.postMedia.name,
    });

    return this.webex.request({
      uri: `${this.mobiusUrl}${DEVICES_ENDPOINT_RESOURCE}/${this.deviceId}/${CALLS_ENDPOINT_RESOURCE}/${this.callId}/${MEDIA_ENDPOINT_RESOURCE}`,
      method: HTTP_METHODS.POST,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callId: this.callId,
        localMedia: {
          roap: roapMessage,
          mediaId: uuid(),
        },
      },
    });
  }

  /* istanbul ignore next */
  /**
   * Setup a listener for roap events emitted by the media sdk.
   */
  private mediaRoapEventsListener() {
    this.mediaConnection.on(
      MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (event: any) => {
        log.info(
          `ROAP message to send (rcv from MEDIA-SDK) :
          \n type:  ${event.roapMessage?.messageType}, seq: ${event.roapMessage.seq} , version: ${event.roapMessage.version}`,
          {}
        );

        log.info(`SDP message to send : \n ${event.roapMessage?.sdp}`, {
          file: CALL_FILE,
          method: this.mediaRoapEventsListener.name,
        });

        switch (event.roapMessage.messageType) {
          case RoapScenario.OK: {
            const mediaOk = {
              received: false,
              message: event.roapMessage,
            };

            this.sendMediaStateMachineEvt({type: 'E_ROAP_OK', data: mediaOk});
            break;
          }

          case RoapScenario.OFFER: {
            // TODO: Remove these after the Media-Core adds the fix
            const sdpVideoPortZero = event.roapMessage.sdp.replace(
              /^m=(video) (?:\d+) /gim,
              'm=$1 0 '
            );

            event.roapMessage.sdp = sdpVideoPortZero;
            this.localRoapMessage = event.roapMessage;
            this.sendCallStateMachineEvt({type: 'E_SEND_CALL_SETUP', data: event.roapMessage});
            break;
          }

          case RoapScenario.ANSWER:
            this.localRoapMessage = event.roapMessage;
            this.sendMediaStateMachineEvt({type: 'E_SEND_ROAP_ANSWER', data: event.roapMessage});
            break;

          case RoapScenario.ERROR:
            this.sendMediaStateMachineEvt({type: 'E_ROAP_ERROR', data: event.roapMessage});
            break;

          case RoapScenario.OFFER_RESPONSE:
            this.localRoapMessage = event.roapMessage;
            this.sendMediaStateMachineEvt({type: 'E_SEND_ROAP_OFFER', data: event.roapMessage});
            break;

          default:
        }
      }
    );
  }

  /* istanbul ignore next */
  /**
   * Setup a listener for remote track added event emitted by the media sdk.
   */
  private mediaTrackListener() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mediaConnection.on(MediaConnectionEventNames.REMOTE_TRACK_ADDED, (e: any) => {
      if (e.type === MEDIA_CONNECTION_EVENT_KEYS.MEDIA_TYPE_AUDIO) {
        this.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, e.track);
      }
    });
  }

  private onEffectEnabled = () => {
    this.metricManager.submitBNRMetric(
      METRIC_EVENT.BNR_ENABLED,
      METRIC_TYPE.BEHAVIORAL,
      this.callId,
      this.correlationId
    );
  };

  private onEffectDisabled = () => {
    this.metricManager.submitBNRMetric(
      METRIC_EVENT.BNR_DISABLED,
      METRIC_TYPE.BEHAVIORAL,
      this.callId,
      this.correlationId
    );
  };

  private updateTrack = (audioTrack: MediaStreamTrack) => {
    this.mediaConnection.updateLocalTracks({audio: audioTrack});
  };

  private registerEffectListener = (addedEffect: TrackEffect) => {
    if (this.localAudioStream) {
      const effect = this.localAudioStream.getEffectByKind(NOISE_REDUCTION_EFFECT);

      if (effect === addedEffect) {
        effect.on(EffectEvent.Enabled, this.onEffectEnabled);
        effect.on(EffectEvent.Disabled, this.onEffectDisabled);
      }
    }
  };

  private unregisterListeners() {
    if (this.localAudioStream) {
      const effect = this.localAudioStream.getEffectByKind(NOISE_REDUCTION_EFFECT);

      if (effect) {
        effect.off(EffectEvent.Enabled, this.onEffectEnabled);
        effect.off(EffectEvent.Disabled, this.onEffectDisabled);
      }

      this.localAudioStream.off(LocalStreamEventNames.EffectAdded, this.registerEffectListener);
      this.localAudioStream.off(LocalStreamEventNames.OutputTrackChange, this.updateTrack);
    }
  }

  private registerListeners(localAudioStream: LocalMicrophoneStream) {
    localAudioStream.on(LocalStreamEventNames.OutputTrackChange, this.updateTrack);

    localAudioStream.on(LocalStreamEventNames.EffectAdded, this.registerEffectListener);

    const effect = localAudioStream.getEffectByKind(NOISE_REDUCTION_EFFECT) as any;

    if (effect) {
      effect.on(EffectEvent.Enabled, this.onEffectEnabled);
      effect.on(EffectEvent.Disabled, this.onEffectDisabled);
      if (effect.isEnabled) {
        this.onEffectEnabled();
      }
    }
  }

  private async delete(): Promise<MobiusCallResponse> {
    const disconnectMetrics = await this.getCallStats();

    return this.webex.request({
      uri: `${this.mobiusUrl}${DEVICES_ENDPOINT_RESOURCE}/${this.deviceId}/${CALLS_ENDPOINT_RESOURCE}/${this.callId}`,
      method: HTTP_METHODS.DELETE,
      service: ALLOWED_SERVICES.MOBIUS,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: {
        device: {
          deviceId: this.deviceId,
          correlationId: this.correlationId,
        },
        callId: this.callId,
        metrics: disconnectMetrics,
        causecode: this.disconnectReason.code,
        cause: this.disconnectReason.cause,
      },
    });
  }

  /**
   * @param state - Current state of the call state machine.
   * @param error - Error object containing the message and type.
   * @param transferMetricAction - Metric action type incase of a transfer metric.
   */
  private submitCallErrorMetric(error: CallError, transferMetricAction?: TRANSFER_ACTION) {
    if (error.getCallError().errorLayer === ERROR_LAYER.CALL_CONTROL) {
      this.metricManager.submitCallMetric(
        METRIC_EVENT.CALL_ERROR,
        transferMetricAction || this.callStateMachine.state.value.toString(),
        METRIC_TYPE.BEHAVIORAL,
        this.callId,
        this.correlationId,
        error
      );
    } else {
      this.metricManager.submitMediaMetric(
        METRIC_EVENT.MEDIA_ERROR,
        this.mediaStateMachine.state.value.toString(),
        METRIC_TYPE.BEHAVIORAL,
        this.callId,
        this.correlationId,
        this.localRoapMessage.sdp,
        this.remoteRoapMessage?.sdp,
        error
      );
    }
  }

  /**
   * Handler for mid call events.
   *
   * @param event - Midcall Events from Mobius.
   */
  public handleMidCallEvent(event: MidCallEvent) {
    const {eventType, eventData} = event;

    switch (eventType) {
      case MidCallEventType.CALL_INFO: {
        log.log(`Received Midcall CallInfo Event for correlationId : ${this.correlationId}`, {
          file: CALL_FILE,
          method: 'handleMidCallEvent',
        });

        const callerData = eventData as MidCallCallerId;

        this.startCallerIdResolution(callerData.callerId);

        break;
      }

      case MidCallEventType.CALL_STATE: {
        log.log(`Received Midcall call event for correlationId : ${this.correlationId}`, {
          file: CALL_FILE,
          method: 'handleMidCallEvent',
        });

        const data = eventData as SupplementaryServiceState;

        /* Emit Events as per the state.
         * We will enter this state only when media negotiation is done
         * So, it's safe to emit events from here.
         */

        switch (data.callState) {
          case MOBIUS_MIDCALL_STATE.HELD: {
            log.log(`Call is successfully held : ${this.correlationId}`, {
              file: CALL_FILE,
              method: 'handleMidCallEvent',
            });

            this.emit(CALL_EVENT_KEYS.HELD, this.correlationId);

            this.held = true;

            if (this.supplementaryServicesTimer) {
              clearTimeout(this.supplementaryServicesTimer);
              this.supplementaryServicesTimer = undefined;
            }

            break;
          }

          case MOBIUS_MIDCALL_STATE.CONNECTED: {
            log.log(`Call is successfully resumed : ${this.correlationId}`, {
              file: CALL_FILE,
              method: 'handleMidCallEvent',
            });

            this.emit(CALL_EVENT_KEYS.RESUMED, this.correlationId);

            this.held = false;

            if (this.supplementaryServicesTimer) {
              clearTimeout(this.supplementaryServicesTimer);
              this.supplementaryServicesTimer = undefined;
            }

            break;
          }

          default: {
            log.warn(
              `Unknown Supplementary service state: ${data.callState} for correlationId : ${this.correlationId}`,
              {
                file: CALL_FILE,
                method: 'handleMidCallEvent',
              }
            );
          }
        }

        break;
      }

      default: {
        log.warn(`Unknown Midcall type: ${eventType} for correlationId : ${this.correlationId}`, {
          file: CALL_FILE,
          method: 'handleMidCallEvent',
        });
      }
    }
  }

  /**
   *
   */
  public getCallerInfo = (): DisplayInformation => this.callerInfo;

  /**
   *
   */
  public end = (): void => {
    this.sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'});
  };

  /**
   *
   */
  public doHoldResume = (): void => {
    if (this.held) {
      this.sendCallStateMachineEvt({type: 'E_CALL_RESUME'});
    } else {
      this.sendCallStateMachineEvt({type: 'E_CALL_HOLD'});
    }
  };

  /**
   * .
   *
   * @param callerInfo
   */
  public startCallerIdResolution(callerInfo: CallerIdInfo) {
    this.callerInfo = this.callerId.fetchCallerDetails(callerInfo);
  }

  /**
   * Sends digit over the established call.
   *
   * @param tone - DTMF tones.
   */
  public sendDigit(tone: string) {
    /* istanbul ignore else */
    try {
      log.info(`Sending digit : ${tone}`, {
        file: CALL_FILE,
        method: 'sendDigit',
      });

      this.mediaConnection.insertDTMF(tone);
    } catch (e: any) {
      log.warn(`Unable to send digit on call: ${e.message}`, {
        file: CALL_FILE,
        method: 'sendDigit',
      });
    }
  }

  /**
   * Mutes/Unmutes the call.
   *
   * @param localAudioTrack -.
   */
  public mute = (localAudioStream: LocalMicrophoneStream): void => {
    if (localAudioStream) {
      localAudioStream.setUserMuted(!this.muted);
      this.muted = !this.muted;
    } else {
      log.warn(`Did not find a local stream while muting the call ${this.getCorrelationId()}.`, {
        file: CALL_FILE,
        method: 'mute',
      });
    }
  };

  /**
   * Change the audio stream of the call.
   *
   * @param newAudioStream - The new audio stream to be used in the call.
   */

  public updateMedia = (newAudioStream: LocalMicrophoneStream): void => {
    const localAudioTrack = newAudioStream.outputStream.getAudioTracks()[0];

    if (!localAudioTrack) {
      log.warn(
        `Did not find a local track while updating media for call ${this.getCorrelationId()}. Will not update media`,
        {
          file: CALL_FILE,
          method: 'updateMedia',
        }
      );

      return;
    }

    try {
      this.mediaConnection.updateLocalTracks({
        audio: localAudioTrack,
      });

      this.unregisterListeners();
      this.registerListeners(newAudioStream);
      this.localAudioStream = newAudioStream;
    } catch (e: any) {
      log.warn(`Unable to update media on call ${this.getCorrelationId()}. Error: ${e.message}`, {
        file: CALL_FILE,
        method: 'updateMedia',
      });
    }
  };

  /**
   * @param broadworksCorrelationInfo
   */
  setBroadworksCorrelationInfo(broadworksCorrelationInfo: string): void {
    this.broadworksCorrelationInfo = broadworksCorrelationInfo;
  }

  /**
   *
   */
  getBroadworksCorrelationInfo(): string | undefined {
    return this.broadworksCorrelationInfo;
  }

  /**
   * Get call stats for an active call.
   *
   * @returns Promise<CallRtpStats> Call Stats.
   */
  getCallRtpStats(): Promise<CallRtpStats> {
    return this.getCallStats();
  }
}

/**
 * @param activeUrl
 * @param webex -.
 * @param dest -.
 * @param dir -.
 * @param deviceId -.
 * @param lineId -.
 * @param serverCb
 * @param deleteCb
 * @param indicator - Service Indicator.
 */
export const createCall = (
  activeUrl: string,
  webex: WebexSDK,
  dest: CallDetails,
  dir: CallDirection,
  deviceId: string,
  lineId: string,
  deleteCb: DeleteRecordCallBack,
  indicator: ServiceIndicator
): ICall => new Call(activeUrl, webex, dest, dir, deviceId, lineId, deleteCb, indicator);
