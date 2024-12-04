import routingAgent from './agent';
import routingContact from './task/contact';
import AgentConfigService from './config';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/websocket/WebSocketManager';
import {ConnectionService} from './core/websocket/connection-service';
import {WebexSDK, SubscribeRequest} from '../types';

export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  public readonly config: AgentConfigService;
  public readonly contact: ReturnType<typeof routingContact>;
  public readonly webSocketManager: WebSocketManager;
  public readonly connectionService: ConnectionService;
  private static instance: Services;

  constructor(options: {webex: WebexSDK; connectionConfig: SubscribeRequest}) {
    const {webex, connectionConfig} = options;
    this.webSocketManager = new WebSocketManager({webex});
    const aqmReq = new AqmReqs(this.webSocketManager);
    this.config = new AgentConfigService();
    this.agent = routingAgent(aqmReq);
    this.contact = routingContact(aqmReq);
    this.connectionService = new ConnectionService({
      webSocketManager: this.webSocketManager,
      subscribeRequest: connectionConfig,
    });
  }

  public static getInstance(options: {
    webex: WebexSDK;
    connectionConfig: SubscribeRequest;
  }): Services {
    if (!this.instance) {
      this.instance = new Services(options);
    }

    return this.instance;
  }
}
