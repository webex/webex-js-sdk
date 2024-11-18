import {WebexSDK} from '../types';
import routingAgent from './agent';
import AgentConfigService from './config';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/WebSocket/WebSocketManager';

export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  public readonly config: AgentConfigService;
  private static instance: Services;

  constructor(options: {webSocketManager: WebSocketManager; webex: WebexSDK}) {
    const {webSocketManager, webex} = options;
    const aqmReq = new AqmReqs(webSocketManager);
    const orgId = webex.credentials.getOrgId();
    this.config = new AgentConfigService(orgId);
    this.agent = routingAgent(aqmReq);
  }

  public static getInstance(options: {
    webSocketManager: WebSocketManager;
    webex: WebexSDK;
  }): Services {
    if (!this.instance) {
      this.instance = new Services(options);
    }

    return this.instance;
  }
}
