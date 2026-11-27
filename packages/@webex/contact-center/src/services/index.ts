import routingAgent from './agent';
import routingContact from './task/contact';
import AgentConfigService from './config';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/websocket/WebSocketManager';
import {ConnectionService} from './core/websocket/connection-service';
import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../types';
import {WCC_API_GATEWAY} from './constants';
import type {SubscribeResponse} from './config/types';
import {TIMEOUT_REQ} from './core/constants';
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
  /** Singleton instance of the Services class */
  private static instance: Services;
  private readonly webex: WebexSDK;

  /**
   * Creates a new Services instance
   * @param options - Configuration options
   * @param options.webex - WebexSDK instance
   */
  constructor(options: {webex: WebexSDK}) {
    const {webex} = options;
    this.webex = webex;
    this.webSocketManager = new WebSocketManager();
    // TODO: Implement reconnection logic for this websocket in upcoming PR
    this.rtdWebSocketManager = new WebSocketManager();
    const aqmReq = new AqmReqs(this.webSocketManager);
    this.config = new AgentConfigService();
    this.agent = routingAgent(aqmReq);
    this.contact = routingContact(aqmReq);
    this.dialer = aqmDialer(aqmReq);
    this.connectionService = new ConnectionService(this.webSocketManager);
  }

  public async subscribe(body: SubscribeRequest, resource: string): Promise<string> {
    const orgId = this.webex.credentials.getOrgId();
    const isIntegration = this.webex.internal.services.isIntegrationEnvironment();
    const response: SubscribeResponse = await this.webex.request({
      service: WCC_API_GATEWAY,
      resource,
      method: HTTP_METHODS.POST,
      body,
      headers: isIntegration && orgId ? {'X-ORGANIZATION-ID': orgId} : undefined,
      timeout: TIMEOUT_REQ,
    });
    if (
      response.statusCode !== undefined &&
      (response.statusCode < 200 || response.statusCode >= 300)
    )
      throw response;

    return response.body?.webSocketUrl;
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
