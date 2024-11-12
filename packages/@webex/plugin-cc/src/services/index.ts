import routingAgent from './agent';
import AqmReqs from './core/aqm-reqs';
import {WebSocketManager} from './core/WebSocket/WebSocketManager';

export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  private static instance: Services;

  constructor(webSocketManager: WebSocketManager) {
    const aqmReq = new AqmReqs(webSocketManager);
    this.agent = routingAgent(aqmReq);
  }

  public static getInstance(webSocketManager: WebSocketManager): Services {
    if (!this.instance) {
      this.instance = new Services(webSocketManager);
    }

    return this.instance;
  }
}
