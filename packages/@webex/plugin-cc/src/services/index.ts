import routingAgent from './agent';
import AgentConfigService from './config';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/WebSocket/WebSocketManager';
import {ConnectionService} from './core/WebSocket/connection-service';
import {WebexSDK, SubscribeRequest} from '../types';

export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  public readonly config: AgentConfigService;
  public readonly webSocketManager: WebSocketManager;
  public readonly connectionService: ConnectionService;
  private static instance: Services;

  constructor(options: {webex: WebexSDK; connectionConfig: SubscribeRequest}) {
    const {webex, connectionConfig} = options;
    this.webSocketManager = new WebSocketManager({webex});
    const aqmReq = new AqmReqs(this.webSocketManager);
    this.config = new AgentConfigService();
    this.agent = routingAgent(aqmReq);
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
