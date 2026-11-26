import routingAgent from './agent';
import routingContact from './task/contact';
import AgentConfigService from './config';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/websocket/WebSocketManager';
import {ConnectionService} from './core/websocket/connection-service';
import type {WebexSDK} from '../types';
import aqmDialer from './task/dialer';

/**
 * Services class provides centralized access to all contact center plugin services
 * using a singleton pattern to ensure a single instance throughout the application.
 * @private
 * @ignore
 * @class
 */
export default class Services {
  /** Agent services for managing agent state and capabilities */
  public readonly agent: ReturnType<typeof routingAgent>;
  /** Configuration services for agent settings */
  public readonly config: AgentConfigService;
  /** Contact services for managing customer interactions */
  public readonly contact: ReturnType<typeof routingContact>;
  /** Dialer services for outbound calling features */
  public readonly dialer: ReturnType<typeof aqmDialer>;
  /** WebSocket manager for handling real-time communications */
  public readonly webSocketManager: WebSocketManager;
  /** RTD WebSocket manager for handling real-time transcription */
  public readonly rtdWebSocketManager: WebSocketManager;
  /** Connection service for managing websocket connections */
  public readonly connectionService: ConnectionService;
  /** Identifies local station replies during recovery. @internal */
  public readonly aqmReqs: AqmReqs;
  /** Singleton instance of the Services class */
  private static instance: Services;

  /**
   * Creates a new Services instance
   * @param options - Configuration options
   * @param options.webex - WebexSDK instance
   */
  constructor(options: {webex: WebexSDK}) {
    const {webex} = options;
    this.webSocketManager = new WebSocketManager({webex});
    // TODO: Implement reconnection logic for this websocket in upcoming PR
    this.rtdWebSocketManager = new WebSocketManager({webex});
    const aqmReq = new AqmReqs(this.webSocketManager);
    this.aqmReqs = aqmReq;
    this.config = new AgentConfigService();
    this.agent = routingAgent(aqmReq);
    this.contact = routingContact(aqmReq);
    this.dialer = aqmDialer(aqmReq);
    this.connectionService = new ConnectionService(this.webSocketManager);
  }

  /**
   * Gets singleton instance of Services class
   * Creates a new instance if one doesn't exist
   * @param options - Configuration options
   * @param options.webex - WebexSDK instance
   * @returns The singleton Services instance
   */
  public static getInstance(options: {webex: WebexSDK}): Services {
    if (!this.instance) {
      this.instance = new Services(options);
    }

    return this.instance;
  }
}
